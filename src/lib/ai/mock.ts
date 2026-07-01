// Mock-провайдеры для разработки без российских ключей (PLAN 3.1).
// Поведение детерминированное — годится для отладки всей цепочки.

import { isKnownUnit, normalizeUnit } from "@/lib/units";
import {
  AsrProvider,
  EmbeddingsProvider,
  ExtractedItem,
  LlmProvider,
  EMBEDDING_DIM,
} from "./types";

const SAMPLE_TRANSCRIPT =
  "10 мешков цемента М500, 3 куба песка и доставка самосвалом";

export const mockAsr: AsrProvider = {
  async transcribe() {
    // В реале сюда приходит аудио. В mock возвращаем образец диктовки.
    return { text: SAMPLE_TRANSCRIPT };
  },
};

// Наивное извлечение: "<кол-во> <ед?> <название>" по запятым/союзу «и».
// Не претендует на точность — это заглушка под реальную LLM (PLAN 3.4).
export const mockLlm: LlmProvider = {
  async extractItems(text: string): Promise<ExtractedItem[]> {
    // \b не работает с кириллицей — разбиваем по запятым и обособленному «и»
    const chunks = text
      .split(/[,;]|\s+и\s+/i)
      .map((s) => s.trim())
      .filter(Boolean);

    return chunks.map((chunk) => {
      // ведущее число
      const numMatch = chunk.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
      const qty = numMatch ? parseFloat(numMatch[1].replace(",", ".")) : 1;
      let rest = (numMatch ? numMatch[2] : chunk).trim();

      // если первое слово — единица измерения, отделяем его
      let unit = "шт";
      const firstWord = rest.match(/^([a-zа-яё²³]+)\s+(.*)$/i);
      if (firstWord && isKnownUnit(firstWord[1])) {
        unit = normalizeUnit(firstWord[1]);
        rest = firstWord[2].trim();
      }

      return {
        name: rest || chunk,
        qty: Number.isFinite(qty) ? qty : 1,
        unit,
      };
    });
  },
};

// Детерминированный псевдо-эмбеддинг: хэш символов → вектор фикс. длины.
// НЕ семантический; нужен только чтобы плумбинг pgvector работал в dev.
export const mockEmbeddings: EmbeddingsProvider = {
  dimension: EMBEDDING_DIM,
  async embed(text: string): Promise<number[]> {
    const v = new Array(EMBEDDING_DIM).fill(0);
    const s = text.toLowerCase();
    for (let i = 0; i < s.length; i++) {
      const code = s.charCodeAt(i);
      v[(code * 31 + i) % EMBEDDING_DIM] += 1;
    }
    // L2-нормализация
    const norm = Math.sqrt(v.reduce((a, b) => a + b * b, 0)) || 1;
    return v.map((x) => x / norm);
  },
  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.embed(t)));
  },
};
