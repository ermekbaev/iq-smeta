import { prisma } from "@/lib/prisma";
import { normalizeText } from "./fuzzy";

/**
 * Расширяет текст запроса синонимами аккаунта (работает в обе стороны).
 * Для каждой группы синонимов: если любое её слово встречается в запросе —
 * дописывает остальные слова группы. Тогда подбор найдёт позицию, названную
 * другим словом («форсунка» → добавит «сопло», и наоборот).
 */
export async function expandWithSynonyms(userId: string, text: string): Promise<string> {
  const groups = await prisma.synonym.findMany({
    where: { userId },
    select: { terms: true },
  });
  if (groups.length === 0) return text;

  const norm = normalizeText(text);
  const extra = new Set<string>();
  for (const g of groups) {
    const terms = g.terms.map((t) => normalizeText(t)).filter(Boolean);
    const hit = terms.some((t) => norm.includes(t));
    if (hit) for (const t of terms) if (!norm.includes(t)) extra.add(t);
  }
  return extra.size ? `${text} ${[...extra].join(" ")}` : text;
}
