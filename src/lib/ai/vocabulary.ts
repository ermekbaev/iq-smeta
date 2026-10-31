// Словарь компании для исправления ослышек: бренды и модели из прайса (латиницей: HUNTER,
// CALLA, IRRITEC…) + слова синонимов. Уходит в задание нейросети, разбирающей диктовку.

import { prisma } from "@/lib/prisma";
import { normalizeText } from "@/lib/match/fuzzy";

const MAX_BRANDS = 80;
const MAX_TERMS = 120;
const TTL = 10 * 60_000;
const cache = new Map<string, { at: number; words: string[] }>();

/** Латинские слова из названий: бренды и серии (≥3 букв, без размеров и единиц). */
export function brandWords(names: string[]): string[] {
  const freq = new Map<string, number>();
  const skip = /^(led|ip\d*|mm|cm|max|min|rgb|rgbw|ww|bl|pro|kit|set|gb|ac|dc|in|out|ss|al|deg|lum|lm|mesh|sdr|pn)$/i;
  for (const n of names) {
    for (const w of n.match(/[A-Za-z][A-Za-z-]{2,}/g) ?? []) {
      const word = w.replace(/-+$/, "");
      if (word.length < 3 || skip.test(word)) continue;
      const key = word.toUpperCase();
      freq.set(key, (freq.get(key) ?? 0) + 1);
    }
  }
  return [...freq].sort((a, b) => b[1] - a[1]).slice(0, MAX_BRANDS).map(([w]) => w);
}

export async function companyVocabulary(userId: string): Promise<string[]> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < TTL) return hit.words;
  const [items, groups] = await Promise.all([
    prisma.priceItem.findMany({ where: { userId }, select: { name: true } }),
    prisma.synonym.findMany({ where: { OR: [{ userId }, { isGlobal: true }] }, select: { terms: true } }),
  ]);
  const terms = [...new Set(groups.flatMap((g) => g.terms).map((t) => normalizeText(t)).filter((t) => t.length >= 3))].slice(0, MAX_TERMS);
  const words = [...brandWords(items.map((i) => i.name)), ...terms];
  cache.set(userId, { at: Date.now(), words });
  return words;
}
