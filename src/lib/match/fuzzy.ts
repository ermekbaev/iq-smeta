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

/** Сходство строк 0..1 (1 = идентичны). */
export function fuzzyScore(a: string, b: string): number {
  const A = trigrams(a);
  const B = trigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return (2 * inter) / (A.size + B.size);
}
