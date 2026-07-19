// Mock-провайдеры для разработки без российских ключей (PLAN 3.1).
// Поведение детерминированное — годится для отладки всей цепочки.

import { isKnownUnit, normalizeUnit } from "@/lib/units";
import {
  AsrProvider,
  EmbeddingsProvider,
  Extraction,
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
  async extractItems(text: string): Promise<Extraction> {
    // Объект и заказчик из начала: «смета Павлово 2 для ИП Адилет, …».
    const { object, client, rest: body } = stripLabels(text);

    // \b не работает с кириллицей — разбиваем по запятым и обособленному «и»
    const chunks = body
      .split(/[,;]|\s+и\s+/i)
      .map((s) => s.trim())
      .filter(Boolean);

    const items = chunks.map((chunk) => {
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

    return { object, client, items };
  },
  // dev-помощник синонимов: детерминированные ответы по маркеру в system-промпте.
  async complete(system: string, user: string): Promise<string> {
    if (system.includes("СИНОНИМЫ-ПОДСКАЗКА")) {
      const canned: Record<string, string[]> = {
        сопло: ["форсунка", "распылитель"],
        дождеватель: ["спринклер"],
        бак: ["ёмкость", "накопитель"],
      };
      return JSON.stringify(canned[user.trim().toLowerCase()] ?? []);
    }
    if (system.includes("СИНОНИМЫ-ПРОВЕРКА")) {
      const t = user.toLowerCase();
      const bad = t.includes("труба") && t.includes("кабель");
      return JSON.stringify(
        bad ? { ok: false, note: "труба и кабель — разные изделия" } : { ok: true, note: "" }
      );
    }
    return "";
  },
};

// Снимает из начала диктовки объект и заказчика (dev-эвристика).
// «смета Павлово 2 для ИП Адилет, …» → object="Павлово 2", client="ИП Адилет".
function stripLabels(text: string): {
  object: string | null;
  client: string | null;
  rest: string;
} {
  let rest = text;
  let object: string | null = null;
  let client: string | null = null;

  // объект: «смета/объект/название X» до «для/заказчик/клиент» или пунктуации
  const om = rest.match(
    /^\s*(?:объект|название|смета)\s+(?!для\b|на\b|заказчик|клиент)(.+?)(?=\s+(?:для|заказчик|клиент)\b|[,;:.]|$)/i
  );
  if (om) {
    object = om[1].trim();
    rest = rest.slice(om[0].length);
  }
  // заказчик: «для/заказчик/клиент X» до пунктуации
  const cm = rest.match(/^\s*[,;:.]?\s*(?:для|заказчик|клиент)\s+([^,;:.]+)[,;:.]?\s*/i);
  if (cm) {
    client = cm[1].trim();
    rest = rest.slice(cm[0].length);
  }
  return { object, client, rest };
}

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
