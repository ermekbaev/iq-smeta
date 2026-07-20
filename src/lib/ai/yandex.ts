// Яндекс Cloud — SpeechKit (ASR) + YandexGPT (LLM + эмбеддинги). PLAN 3.1.
// Рублёвый биллинг, РФ. Готово к проду, без ключей заказчика не протестировано.
//
// Авторизация: Api-Key (Authorization: Api-Key <key>) + folderId.
// ВНИМАНИЕ:
//  - SpeechKit v1 (короткое аудио) принимает OggOpus/LPCM, а браузер MediaRecorder
//    обычно пишет webm/opus. Аудиопоток (opus) тот же, отличается контейнер —
//    на проде писать audio/ogg или перекодировать на бэке. Длинные записи → async API.
//  - Эмбеддинги YandexGPT — 256-мерные (не 1024). Если выбран Яндекс для подбора,
//    сменить EMBEDDING_DIM на 256 И vector(256) в схеме + миграция (см. guard в index.ts).

import { AsrProvider, EmbeddingsProvider, LlmProvider, Extraction } from "./types";
import { EXTRACT_SYSTEM_PROMPT, parseExtraction } from "./prompt";
import { concurrentMap, withRetry } from "./util";

export const YANDEX_EMBEDDING_DIM = 256;

const STT_URL = "https://stt.api.cloud.yandex.net/speech/v1/stt:recognize";
const LLM_URL = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion";
const EMB_URL = "https://llm.api.cloud.yandex.net/foundationModels/v1/textEmbedding";

function cfg() {
  const apiKey = process.env.YANDEX_API_KEY;
  const folderId = process.env.YANDEX_FOLDER_ID;
  if (!apiKey || !folderId) {
    throw new Error("YANDEX_API_KEY / YANDEX_FOLDER_ID не заданы");
  }
  return { apiKey, folderId };
}

// Один запрос к синхронному STT v1 (лимит ~30 c / 1 МБ на запрос).
async function sttRecognize(
  body: Buffer,
  fmt: string,
  apiKey: string,
  folderId: string
): Promise<string> {
  const url = `${STT_URL}?folderId=${folderId}&lang=ru-RU&format=${fmt}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Api-Key ${apiKey}` },
    body: body as unknown as BodyInit,
  });
  if (!res.ok) throw new Error(`SpeechKit ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { result?: string };
  return data.result ?? "";
}

export const yandexAsr: AsrProvider = {
  async transcribe(audio, opts) {
    const { apiKey, folderId } = cfg();
    const isWav = opts?.mimeType?.includes("wav");

    if (isWav) {
      // WAV (16-бит PCM, 16 кГц) → LPCM: снимаем 44-байтный заголовок.
      // Синхронный STT v1 не принимает >30 c / >1 МБ, поэтому длинную запись
      // режем на куски по ~25 c (25·16000·2 = 800 КБ < 1 МБ) и склеиваем текст.
      const pcm = audio.subarray(44);
      const CHUNK = 25 * 16000 * 2;
      const parts: string[] = [];
      for (let off = 0; off < pcm.length; off += CHUNK) {
        const slice = pcm.subarray(off, Math.min(off + CHUNK, pcm.length));
        const t = await sttRecognize(
          Buffer.from(slice),
          "lpcm&sampleRateHertz=16000",
          apiKey,
          folderId
        );
        if (t.trim()) parts.push(t.trim());
      }
      return { text: parts.join(" ").trim() };
    }

    // Не-WAV (ogg/opus) — одним запросом.
    const text = await sttRecognize(audio, "oggopus", apiKey, folderId);
    return { text };
  },
};

// Один запрос к YandexGPT (system + user) → текст ответа.
async function yandexComplete(system: string, user: string, maxTokens = 2000): Promise<string> {
  const { apiKey, folderId } = cfg();
  const model = process.env.YANDEX_GPT_MODEL || "yandexgpt";
  const res = await fetch(LLM_URL, {
    method: "POST",
    headers: { Authorization: `Api-Key ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      modelUri: `gpt://${folderId}/${model}/latest`,
      completionOptions: { temperature: 0, maxTokens },
      messages: [
        { role: "system", text: system },
        { role: "user", text: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`YandexGPT ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as {
    result?: { alternatives?: { message?: { text?: string } }[] };
  };
  return data.result?.alternatives?.[0]?.message?.text ?? "";
}

export const yandexLlm: LlmProvider = {
  async extractItems(text: string): Promise<Extraction> {
    return parseExtraction(await yandexComplete(EXTRACT_SYSTEM_PROMPT, text));
  },
};

export const yandexEmbeddings: EmbeddingsProvider = {
  dimension: YANDEX_EMBEDDING_DIM,
  async embed(text: string): Promise<number[]> {
    const { apiKey, folderId } = cfg();
    return withRetry(async () => {
      const res = await fetch(EMB_URL, {
        method: "POST",
        headers: { Authorization: `Api-Key ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          modelUri: `emb://${folderId}/text-search-doc/latest`,
          text,
        }),
      });
      if (!res.ok) throw new Error(`Yandex Embeddings ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as { embedding?: number[] };
      if (!data.embedding) throw new Error("Yandex: пустой эмбеддинг");
      return data.embedding;
    });
  },
  // У Яндекса нет батч-эндпоинта — параллелим с ограничением (4 запроса).
  async embedBatch(texts: string[]): Promise<number[][]> {
    return concurrentMap(texts, 4, (t) => this.embed(t));
  },
};
