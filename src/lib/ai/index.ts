// Точка выбора провайдеров ИИ (PLAN 3.1).
// AI_PROVIDER=mock — всё на заглушках (dev).
// AI_PROVIDER=prod — реальные сервисы, собираются по-сервисно:
//   ASR_PROVIDER  (yandex | gemini)            — речь → текст
//   LLM_PROVIDER  (gigachat | yandex | gemini) — извлечение позиций + эмбеддинги
// gemini — для dev-тестов из стран без доступа к РФ-сервисам.
// Остальной код работает только через интерфейсы из ./types.

import { AiProvider, AsrProvider, EmbeddingsProvider, LlmProvider, EMBEDDING_DIM } from "./types";
import { mockAsr, mockEmbeddings, mockLlm } from "./mock";
import { gigachatEmbeddings, gigachatLlm } from "./gigachat";
import { yandexAsr, yandexEmbeddings, yandexLlm } from "./yandex";
import { geminiAsr, geminiEmbeddings, geminiLlm } from "./gemini";

const provider = (process.env.AI_PROVIDER ?? "mock").toLowerCase();

function buildProd(): AiProvider {
  const asrName = (process.env.ASR_PROVIDER ?? "yandex").toLowerCase();
  const llmName = (process.env.LLM_PROVIDER ?? "gigachat").toLowerCase();

  const asrMap: Record<string, AsrProvider> = { yandex: yandexAsr, gemini: geminiAsr };
  const asr = asrMap[asrName];
  if (!asr) throw new Error(`ASR_PROVIDER="${asrName}" не поддержан (есть: yandex, gemini).`);

  const llmMap: Record<string, { llm: LlmProvider; embeddings: EmbeddingsProvider }> = {
    gigachat: { llm: gigachatLlm, embeddings: gigachatEmbeddings },
    yandex: { llm: yandexLlm, embeddings: yandexEmbeddings },
    gemini: { llm: geminiLlm, embeddings: geminiEmbeddings },
  };
  const sel = llmMap[llmName];
  if (!sel)
    throw new Error(`LLM_PROVIDER="${llmName}" не поддержан (есть: gigachat, yandex, gemini).`);
  const { llm, embeddings } = sel;

  // Guard: размерность вектора провайдера обязана совпадать со схемой (vector(N)).
  if (embeddings.dimension !== EMBEDDING_DIM) {
    throw new Error(
      `Размерность эмбеддингов провайдера (${embeddings.dimension}) ≠ EMBEDDING_DIM (${EMBEDDING_DIM}). ` +
        `Поменяйте EMBEDDING_DIM в src/lib/ai/types.ts и vector(N) в schema.prisma, затем миграцию.`
    );
  }

  return { asr, llm, embeddings };
}

function build(): AiProvider {
  switch (provider) {
    case "mock":
      return { asr: mockAsr, llm: mockLlm, embeddings: mockEmbeddings };
    case "prod":
      return buildProd();
    default:
      throw new Error(`Неизвестный AI_PROVIDER="${provider}". Доступно: mock, prod.`);
  }
}

export const ai: AiProvider = build();
export * from "./types";
