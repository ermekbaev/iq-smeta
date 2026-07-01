import { prisma } from "@/lib/prisma";
import { ai } from "@/lib/ai";
import { setEmbedding } from "@/lib/match";
import type { ParsedRow } from "./parse";

export interface ImportResult {
  created: number;
  updated: number;
}

/**
 * Импорт разобранных строк прайса: upsert по (name, unit) + эмбеддинг названия.
 * Повторная загрузка обновляет цену/категорию, aliases и сметы не рушатся.
 */
export async function importPrice(rows: ParsedRow[]): Promise<ImportResult> {
  let created = 0;
  let updated = 0;
  const saved: { id: string; name: string }[] = [];

  // 1) upsert позиций
  for (const row of rows) {
    const existing = await prisma.priceItem.findUnique({
      where: { name_unit: { name: row.name, unit: row.unit } },
      select: { id: true },
    });
    const item = await prisma.priceItem.upsert({
      where: { name_unit: { name: row.name, unit: row.unit } },
      create: { name: row.name, unit: row.unit, price: row.price, category: row.category },
      update: { price: row.price, category: row.category },
      select: { id: true },
    });
    if (existing) updated++;
    else created++;
    saved.push({ id: item.id, name: row.name });
  }

  // 2) эмбеддинги пачкой (PLAN 3.2): один батч-запрос вместо N одиночных —
  // выдерживает большой прайс без упора в rate-limit (PLAN 8).
  const vectors = await ai.embeddings.embedBatch(saved.map((s) => s.name));
  for (let i = 0; i < saved.length; i++) {
    await setEmbedding(saved[i].id, vectors[i]);
  }

  return { created, updated };
}
