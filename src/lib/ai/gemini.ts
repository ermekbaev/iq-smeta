// Google Gemini — ASR (аудио) + LLM + эмбеддинги. Для dev-тестов из стран,
// где российские сервисы недоступны (PLAN 3.1: «на разработке — на чём удобно»).
// Бесплатный tier, ключ из Google AI Studio (aistudio.google.com).
//
// На прод заменяется на российского провайдера (GigaChat/Яндекс) сменой env.
// ВНИМАНИЕ: эмбеддинги text-embedding-004 — 768-мерные (см. EMBEDDING_DIM).

import { AsrProvider, EmbeddingsProvider, LlmProvider, ExtractedItem } from "./types";
import { EXTRACT_SYSTEM_PROMPT, parseExtraction } from "./prompt";
import { chunk, withRetry } from "./util";

// Размер пачки для batchEmbedContents. На free-tier Gemini лимит эмбеддингов —
// 100 запросов/мин, а каждый элемент батча считается запросом; берём 90 с запасом.
// Между батчами withRetry ждёт столько, сколько велит 429 (на платном 429 не будет).
const EMB_BATCH = 90;

export const GEMINI_EMBEDDING_DIM = 768;

const BASE = "https://generativelanguage.googleapis.com/v1beta";
const GEN_MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
const EMB_MODEL = process.env.GEMINI_EMB_MODEL || "gemini-embedding-001";

function key(): string {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error("GEMINI_API_KEY не задан");
  return k;
}

async function gen(
  parts: unknown[],
  opts: { system?: string; jsonOut?: boolean }
): Promise<string> {
  return withRetry(async () => {
    const res = await fetch(`${BASE}/models/${GEN_MODEL}:generateContent?key=${key()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0,
          ...(opts.jsonOut ? { responseMimeType: "application/json" } : {}),
        },
      }),
    });
    if (!res.ok) throw new Error(`Gemini gen ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  });
}

export const geminiLlm: LlmProvider = {
  async extractItems(text: string): Promise<ExtractedItem[]> {
    return parseExtraction(
      await gen([{ text }], { system: EXTRACT_SYSTEM_PROMPT, jsonOut: true })
    );
  },
};

export const geminiEmbeddings: EmbeddingsProvider = {
  dimension: GEMINI_EMBEDDING_DIM,
  async embed(text: string): Promise<number[]> {
    return withRetry(async () => {
      const res = await fetch(`${BASE}/models/${EMB_MODEL}:embedContent?key=${key()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: `models/${EMB_MODEL}`,
          content: { parts: [{ text }] },
          // фиксируем размерность под схему vector(768)
          outputDimensionality: GEMINI_EMBEDDING_DIM,
        }),
      });
      if (!res.ok) throw new Error(`Gemini embed ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as { embedding?: { values?: number[] } };
      const vec = data.embedding?.values;
      if (!vec) throw new Error("Gemini: пустой эмбеддинг");
      return vec;
    });
  },
  async embedBatch(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    // одна пачка = один запрос batchEmbedContents (вместо N одиночных)
    for (const part of chunk(texts, EMB_BATCH)) {
      const vecs = await withRetry(async () => {
        const res = await fetch(
          `${BASE}/models/${EMB_MODEL}:batchEmbedContents?key=${key()}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              requests: part.map((text) => ({
                model: `models/${EMB_MODEL}`,
                content: { parts: [{ text }] },
                outputDimensionality: GEMINI_EMBEDDING_DIM,
              })),
            }),
          }
        );
        if (!res.ok) throw new Error(`Gemini batchEmbed ${res.status}: ${await res.text()}`);
        const data = (await res.json()) as { embeddings?: { values?: number[] }[] };
        const list = data.embeddings?.map((e) => e.values ?? []);
        if (!list || list.length !== part.length) {
          throw new Error("Gemini: неполный ответ batchEmbedContents");
        }
        return list;
      });
      out.push(...vecs);
    }
    return out;
  },
};

export const geminiAsr: AsrProvider = {
  // Gemini принимает аудио инлайном. Поддержка контейнеров: ogg/mp3/wav/flac/aac.
  // Chrome пишет webm/opus — может не приняться; тогда тестировать вводом текста
  // или писать audio/ogg. См. PLAN 3.3 (ASR-нюанс).
  async transcribe(audio, opts) {
    const text = await gen(
      [
        {
          inlineData: {
            mimeType: opts?.mimeType || "audio/ogg",
            data: audio.toString("base64"),
          },
        },
        { text: "Расшифруй аудио дословно на русском. Верни только текст, без пояснений." },
      ],
      {}
    );
    return { text: text.trim() };
  },
};
