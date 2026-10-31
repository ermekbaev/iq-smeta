// Нечёткое сравнение строк (PLAN 3.2, слой 2) — дополнительный сигнал к семантике.
// Триграммное сходство Дайса: устойчиво к окончаниям и порядку слов.

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trigrams(s: string): Set<string> {
  const t = ` ${normalizeText(s)} `;
  const set = new Set<string>();
  for (let i = 0; i < t.length - 2; i++) set.add(t.slice(i, i + 3));
  return set;
}

function dice(a: string, b: string): number {
  const A = trigrams(a);
  const B = trigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return (2 * inter) / (A.size + B.size);
}

const CYR: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "i", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sh",
  ъ: "", ы: "i", ь: "", э: "e", ю: "u", я: "a",
};

/** Звучание латиницей, грубо: «хантер» и «HUNTER» → «hntr», «калла» и «CALLA» → «kl». */
export function soundKey(s: string): string {
  const lat = normalizeText(s)
    .split("")
    .map((ch) => CYR[ch] ?? ch)
    .join("")
    .replace(/kh/g, "h")
    .replace(/ph/g, "f")
    .replace(/w/g, "v")
    .replace(/q|c(?=[aou ]|$)/g, "k")
    .replace(/c/g, "s")
    .replace(/x/g, "ks");
  // согласный скелет слов: гласные распознавание пишет как придётся
  return lat
    .split(" ")
    .map((w) => (/^\d+$/.test(w) ? w : w.replace(/[aeiouy]/g, "").replace(/(.)\1+/g, "$1")))
    .filter(Boolean)
    .join(" ");
}

const hasLat = (s: string) => /[a-z]/i.test(s);
const hasCyr = (s: string) => /[а-яё]/i.test(s);

/**
 * Сходство строк 0..1 (1 = идентичны). Если одна сторона кириллицей, а другая латиницей
 * («хантер» ↔ «HUNTER», «рейн берд» ↔ «Rain Bird»), сравнивается ещё и звучание.
 */
export function fuzzyScore(a: string, b: string): number {
  const plain = dice(a, b);
  const mixed = (hasCyr(a) && hasLat(b)) || (hasLat(a) && hasCyr(b));
  if (!mixed) return plain;
  return Math.max(plain, 0.85 * dice(soundKey(a), soundKey(b)));
}
