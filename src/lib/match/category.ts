// Категории подбора: сузить поиск по прайсу до раздела («бери из дренажа»).
// Чистая логика (без БД) — используется и на клиенте, и на сервере.

import { fuzzyScore, normalizeText } from "./fuzzy";

// Слова-команды, после которых человек называет категорию.
// «бери из благоустройства», «возьми по дренажу», «категория освещение».
const TRIGGER =
  /^(бер[иёе]м?|возьм[иёе]м?|взять|смотр[иы]|ищ[иы]|из|по|категори[яию]|раздел[аы]?)$/i;

/** Команда обязана начинать диктовку: иначе «20 метров трубы ИЗ ПНД» или
 *  «доставка ПО объекту» ложно сужали бы подбор на всю смету. */
function startsWithTrigger(head: string): boolean {
  const first = normalizeText(head).split(" ")[0];
  return !!first && TRIGGER.test(first);
}

/** Порог схожести для сопоставления произнесённого с названием категории. */
const CATEGORY_MATCH_MIN = 0.5;
/** Частичное совпадение (фрагмент фразы) слабее полного — чтобы длинные
 *  категории не проигрывали коротким, входящим в них как часть. */
const PARTIAL_PENALTY = 0.9;

/** Общий корень: «дренажа» ↔ «дренаж» (падежи). */
function sameStem(a: string, b: string): boolean {
  const n = Math.min(a.length, b.length, 5);
  return n >= 4 && a.slice(0, n) === b.slice(0, n);
}

function similarity(a: string, b: string): number {
  return Math.max(fuzzyScore(a, b), sameStem(a, b) ? 0.75 : 0);
}

/** Слова фразы без служебных (команда/предлоги). */
function meaningfulWords(spoken: string): string[] {
  return normalizeText(spoken)
    .split(" ")
    .filter((w) => w && !TRIGGER.test(w));
}

/**
 * Подобрать категорию из списка по произнесённому тексту.
 * Устойчив к падежам и к тому, что после названия идут позиции.
 */
export function matchCategory(spoken: string, categories: string[]): string | null {
  const words = meaningfulWords(spoken);
  if (words.length === 0) return null;
  const phrase = words.join(" ");

  let best: { category: string; score: number } | null = null;

  for (const category of categories) {
    const cat = normalizeText(category);
    if (!cat) continue;

    // 1) вся фраза целиком ≈ название категории (основной случай)
    let score = similarity(phrase, cat);

    // 2) фрагмент фразы ≈ категория — когда после названия идут позиции
    //    («бери из дренажа 10 труб»). Слабее полного совпадения.
    const chunks = [...words];
    for (let i = 0; i < words.length - 1; i++) chunks.push(`${words[i]} ${words[i + 1]}`);
    for (const chunk of chunks) {
      score = Math.max(score, similarity(chunk, cat) * PARTIAL_PENALTY);
    }

    if (score >= CATEGORY_MATCH_MIN && (!best || score > best.score)) {
      best = { category, score };
    }
  }

  return best?.category ?? null;
}

export interface CategoryCommand {
  category: string | null;
  /** Текст диктовки без команды — уходит в извлечение позиций. */
  text: string;
}

/**
 * Срезает из начала голову-команду: служебные слова + слова названия категории.
 * Каждое слово категории «расходуется» один раз, иначе «бери из 12 вольт 12 метров»
 * съело бы и количество позиции.
 */
function stripCommand(head: string, category: string): string {
  const remaining = normalizeText(category).split(" ").filter(Boolean);
  const words = head.trim().split(/\s+/);

  let i = 0;
  for (; i < words.length; i++) {
    const w = normalizeText(words[i]);
    if (!w) continue;
    if (TRIGGER.test(w)) continue; // служебное слово команды
    const hit = remaining.findIndex((cw) => cw === w || similarity(w, cw) >= 0.6);
    if (hit === -1) break; // пошли позиции — дальше не режем
    remaining.splice(hit, 1); // слово категории израсходовано
  }
  return words.slice(i).join(" ");
}

/**
 * Выделить из начала диктовки команду выбора категории.
 * «Бери из дренажа: 10 труб» → { category: "Дренаж", text: "10 труб" }.
 * Команду ищем только в начале — так её и произносят, а внутри текста
 * «из» встречается в обычных позициях («труба из ПНД») и ложно срабатывала бы.
 */
export function detectCategoryCommand(
  text: string,
  categories: string[]
): CategoryCommand {
  if (!text.trim() || categories.length === 0) return { category: null, text };

  // голова диктовки — до первого разделителя (или первые ~80 символов)
  const m = text.match(/^([^,.;:!?]{0,80})([,.;:!?]\s*|$)/);
  if (!m) return { category: null, text };

  const head = m[1];
  if (!startsWithTrigger(head)) return { category: null, text };

  const category = matchCategory(head, categories);
  if (!category) return { category: null, text };

  // из головы убираем только команду — остаток головы это уже позиции
  const restOfHead = stripCommand(head, category);
  const tail = text.slice(m[0].length);
  return { category, text: [restOfHead, tail].filter(Boolean).join(" ").trim() };
}
