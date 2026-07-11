import { prisma } from "@/lib/prisma";
import { normalizeText } from "./fuzzy";

/**
 * Чистая логика расширения (без БД — тестируемая).
 * Для каждой группы: если любое её слово есть в тексте — дописывает остальные.
 * Работает в обе стороны («форсунка» → добавит «сопло», и наоборот).
 */
export function applySynonyms(groups: string[][], text: string): string {
  if (groups.length === 0) return text;

  // сопоставление по границам слов/фраз (пробелы по краям), чтобы «бак» не
  // цеплялся в «табак»; при этом многословные термы («гибкая подводка») работают
  const norm = ` ${normalizeText(text)} `;
  const has = (t: string) => norm.includes(` ${t} `);

  const extra = new Set<string>();
  for (const group of groups) {
    const terms = group.map((t) => normalizeText(t)).filter(Boolean);
    if (terms.some(has)) for (const t of terms) if (!has(t)) extra.add(t);
  }
  return extra.size ? `${text.trim()} ${[...extra].join(" ")}` : text;
}

/** Расширяет запрос синонимами аккаунта (грузит группы из БД, применяет applySynonyms). */
export async function expandWithSynonyms(userId: string, text: string): Promise<string> {
  const groups = await prisma.synonym.findMany({
    where: { userId },
    select: { terms: true },
  });
  return applySynonyms(
    groups.map((g) => g.terms),
    text
  );
}
