// ИИ-помощник словаря синонимов (вариант A: общую базу ведёт человек, ИИ — подсказывает).
//
// Принцип: ИИ ПРЕДЛАГАЕТ и ПОДСВЕЧИВАЕТ, финальное «да» — за человеком.
// Никогда не заливаем в базу автоматически (ошибка ИИ поехала бы по всем аккаунтам).
// Если провайдер не умеет `complete` или запрос упал — деградируем мягко:
//   подсказки нет, проверка возвращает «ок» (не блокируем ручное добавление).

import { ai } from "@/lib/ai";
import { normalizeText } from "./fuzzy";

// Маркеры в начале system-промптов — по ним mock-провайдер отдаёт детерминированный
// ответ в dev; на проде (YandexGPT) это просто первая строка инструкции.
const SUGGEST_SYSTEM = `СИНОНИМЫ-ПОДСКАЗКА.
Ты — помощник сметчика в строительстве и благоустройстве (полив, дренаж, освещение, мощение, газон).
Пользователь даёт слово-термин. Верни синонимы и профессиональный жаргон, которыми
это ЖЕ изделие или работу называют в РФ. Не добавляй пояснений.
Ответ — строго JSON-массив строк, например: ["форсунка","распылитель"].
Если синонимов нет — верни [].`;

const VALIDATE_SYSTEM = `СИНОНИМЫ-ПРОВЕРКА.
Ты — помощник сметчика. Проверь, означают ли перечисленные слова ОДНО И ТО ЖЕ
изделие или работу (взаимозаменяемы при подборе позиции по прайсу).
Ответ — строго JSON: {"ok": true|false, "note": "кратко, почему"}.
Поставь ok=false, если среди слов есть разные по смыслу (например «труба» и «кабель»).`;

export interface SynonymVerdict {
  ok: boolean;
  note: string;
}

/** true, если провайдер вообще умеет разовые запросы к LLM (иначе ИИ-фичи скрыты). */
export function aiHelperAvailable(): boolean {
  return typeof ai.llm.complete === "function";
}

/** Предложить синонимы к слову. Возвращает [] при недоступности/ошибке ИИ. */
export async function suggestSynonyms(term: string): Promise<string[]> {
  const t = term.trim();
  if (!t || !ai.llm.complete) return [];
  let raw: string;
  try {
    raw = await ai.llm.complete(SUGGEST_SYSTEM, t);
  } catch {
    return [];
  }
  const seen = new Set<string>([normalizeText(t)]); // само слово не предлагаем
  const out: string[] = [];
  for (const s of parseStringArray(raw)) {
    const v = s.trim().toLowerCase();
    const n = normalizeText(v);
    if (v && n && !seen.has(n)) {
      seen.add(n);
      out.push(v);
    }
  }
  return out.slice(0, 12);
}

/** Проверить, что слова группы — действительно синонимы. «ок» при недоступности ИИ. */
export async function validateSynonymGroup(terms: string[]): Promise<SynonymVerdict> {
  const clean = terms.map((t) => t.trim()).filter(Boolean);
  if (clean.length < 2 || !ai.llm.complete) return { ok: true, note: "" };
  let raw: string;
  try {
    raw = await ai.llm.complete(VALIDATE_SYSTEM, clean.join(", "));
  } catch {
    return { ok: true, note: "" };
  }
  return parseVerdict(raw);
}

// --- парсеры ответа ИИ (чистые, тестируемые; терпимы к ```json и «мусору» вокруг) ---

export function parseStringArray(raw: string): string[] {
  const m = raw.match(/\[[\s\S]*\]/);
  if (!m) return [];
  try {
    const v: unknown = JSON.parse(m[0]);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function parseVerdict(raw: string): SynonymVerdict {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return { ok: true, note: "" };
  try {
    const v = JSON.parse(m[0]) as { ok?: unknown; note?: unknown };
    return {
      ok: v.ok !== false, // всё, кроме явного false, считаем «ок»
      note: typeof v.note === "string" ? v.note : "",
    };
  } catch {
    return { ok: true, note: "" };
  }
}
