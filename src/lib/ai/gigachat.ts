// GigaChat (Сбер) — LLM + эмбеддинги (PLAN 3.1). Рублёвый биллинг, РФ.
// ASR у GigaChat нет — речь распознаём Яндекс SpeechKit (см. yandex.ts).
//
// Готово к проду, но без ключей заказчика не протестировано вживую.
// TLS: Сбер использует «Russian Trusted CA». Node его не знает — на проде
// задать переменную окружения NODE_EXTRA_CA_CERTS=/path/russian-ca.pem
// (нативный механизм Node, без кода). В dev на крайний случай — NODE_TLS_REJECT_UNAUTHORIZED=0.

import { randomUUID } from "node:crypto";
import { EmbeddingsProvider, LlmProvider, Extraction } from "./types";
import { EXTRACT_SYSTEM_PROMPT, parseExtraction } from "./prompt";
import { chunk, withRetry } from "./util";

export const GIGACHAT_EMBEDDING_DIM = 1024;

const OAUTH_URL = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth";
const BASE = "https://gigachat.devices.sberbank.ru/api/v1";
const SCOPE = process.env.GIGACHAT_SCOPE || "GIGACHAT_API_PERS";

let cachedToken: { value: string; exp: number } | null = null;

async function getToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.exp - 60_000 > now) return cachedToken.value;

  const authKey = process.env.GIGACHAT_AUTH_KEY;
  if (!authKey) throw new Error("GIGACHAT_AUTH_KEY не задан");

  const res = await fetch(OAUTH_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${authKey}`,
      RqUID: randomUUID(),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({ scope: SCOPE }),
  });
  if (!res.ok) throw new Error(`GigaChat OAuth ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; expires_at: number };
  cachedToken = { value: data.access_token, exp: data.expires_at };
  return data.access_token;
}

async function api(path: string, body: unknown): Promise<unknown> {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GigaChat ${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

export const gigachatLlm: LlmProvider = {
  async extractItems(text: string): Promise<Extraction> {
    const data = (await api("/chat/completions", {
      model: process.env.GIGACHAT_MODEL || "GigaChat",
      temperature: 0,
      messages: [
        { role: "system", content: EXTRACT_SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
    })) as { choices?: { message?: { content?: string } }[] };
    return parseExtraction(data.choices?.[0]?.message?.content ?? "");
  },
};

export const gigachatEmbeddings: EmbeddingsProvider = {
  dimension: GIGACHAT_EMBEDDING_DIM,
  async embed(text: string): Promise<number[]> {
    return (await this.embedBatch([text]))[0];
  },
  async embedBatch(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    // GigaChat /embeddings принимает массив input — пачкой
    for (const part of chunk(texts, 100)) {
      const data = (await withRetry(() =>
        api("/embeddings", { model: "Embeddings", input: part })
      )) as { data?: { embedding?: number[] }[] };
      const list = data.data?.map((d) => d.embedding ?? []);
      if (!list || list.length !== part.length) {
        throw new Error("GigaChat: неполный ответ embeddings");
      }
      out.push(...list);
    }
    return out;
  },
};
