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

import { AsrProvider, EmbeddingsProvider, LlmProvider, ExtractedItem } from "./types";
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

export const yandexAsr: AsrProvider = {
  async transcribe(audio, opts) {
    const { apiKey, folderId } = cfg();
    // Фронтенд пишет WAV (16-бит PCM, 16 кГц) — для SpeechKit это lpcm:
    // снимаем 44-байтный WAV-заголовок и передаём сырой PCM + частоту.
    const isWav = opts?.mimeType?.includes("wav");
    const body = isWav ? audio.subarray(44) : audio;
    const fmt = isWav
      ? "lpcm&sampleRateHertz=16000"
      : "oggopus";
    const url = `${STT_URL}?folderId=${folderId}&lang=ru-RU&format=${fmt}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Api-Key ${apiKey}` },
      body: body as unknown as BodyInit,
    });
    if (!res.ok) throw new Error(`SpeechKit ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { result?: string };
    return { text: data.result ?? "" };
  },
};

export const yandexLlm: LlmProvider = {
  async extractItems(text: string): Promise<ExtractedItem[]> {
    const { apiKey, folderId } = cfg();
    const model = process.env.YANDEX_GPT_MODEL || "yandexgpt";
    const res = await fetch(LLM_URL, {
      method: "POST",
      headers: { Authorization: `Api-Key ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        modelUri: `gpt://${folderId}/${model}/latest`,
        completionOptions: { temperature: 0, maxTokens: 2000 },
        messages: [
          { role: "system", text: EXTRACT_SYSTEM_PROMPT },
          { role: "user", text },
        ],
      }),
    });
    if (!res.ok) throw new Error(`YandexGPT ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as {
      result?: { alternatives?: { message?: { text?: string } }[] };
    };
    return parseExtraction(data.result?.alternatives?.[0]?.message?.text ?? "");
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
