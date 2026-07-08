// Контракты адаптеров ИИ (PLAN 3.1).
// Провайдер меняется одной заменой в src/lib/ai/index.ts, логика не трогается.

// Размерность вектора в БД. ДОЛЖНА совпадать с vector(N) в schema.prisma.
// Зависит от ВЫБРАННОГО провайдера эмбеддингов (у каждого своя):
//   YandexGPT textEmbedding     — 256 (текущий прод)
//   Gemini Embedding            — настраивается через outputDimensionality
//   GigaChat Embeddings         — 1024
// Сменить провайдера = поменять это число + vector(N) в схеме + миграция
// (guard в ./index.ts сверяет dimension активного провайдера с этим значением).
export const EMBEDDING_DIM = 256;

export interface AsrProvider {
  /** Аудио (webm/ogg/wav) → распознанный текст. */
  transcribe(audio: Buffer, opts?: { mimeType?: string }): Promise<{ text: string }>;
}

/** Позиция, извлечённая LLM из расшифрованного текста (PLAN 3.4). */
export interface ExtractedItem {
  name: string;
  qty: number;
  unit: string;
  /** Цена за единицу, если прораб назвал её голосом (иначе берётся из прайса). */
  price?: number;
}

/** Результат разбора диктовки: заказчик (если назван) + позиции (PLAN 3.4). */
export interface Extraction {
  /** Имя заказчика, если в речи было «смета для…»/«заказчик…»; иначе null. */
  client: string | null;
  items: ExtractedItem[];
}

export interface LlmProvider {
  /** Свободный текст диктовки → заказчик + структурированный список позиций. */
  extractItems(text: string): Promise<Extraction>;
}

export interface EmbeddingsProvider {
  readonly dimension: number;
  /** Текст → вектор длины dimension. */
  embed(text: string): Promise<number[]>;
  /** Пакетное получение векторов (для загрузки больших прайсов). */
  embedBatch(texts: string[]): Promise<number[][]>;
}

export interface AiProvider {
  asr: AsrProvider;
  llm: LlmProvider;
  embeddings: EmbeddingsProvider;
}
