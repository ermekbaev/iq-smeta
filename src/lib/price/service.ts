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
export async function importPrice(userId: string, rows: ParsedRow[]): Promise<ImportResult> {
  let created = 0;
  let updated = 0;
  const saved: { id: string; text: string }[] = [];

  // 1) upsert позиций (в рамках аккаунта)
  for (const row of rows) {
    const existing = await prisma.priceItem.findUnique({
      where: { userId_name_unit: { userId, name: row.name, unit: row.unit } },
      select: { id: true },
    });
    const item = await prisma.priceItem.upsert({
      where: { userId_name_unit: { userId, name: row.name, unit: row.unit } },
      create: {
        userId,
        article: row.article,
        name: row.name,
        unit: row.unit,
        price: row.price,
        cost: row.cost,
        category: row.category,
      },
      update: {
        article: row.article,
        price: row.price,
        cost: row.cost,
        category: row.category,
      },
      select: { id: true },
    });
    if (existing) updated++;
    else created++;
    // эмбеддинг по «артикул + название» — чтобы работал и поиск по коду
    saved.push({ id: item.id, text: [row.article, row.name].filter(Boolean).join(" ") });
  }

  // 2) эмбеддинги пачкой (PLAN 3.2): один батч-запрос вместо N одиночных —
  // выдерживает большой прайс без упора в rate-limit (PLAN 8).
  const vectors = await ai.embeddings.embedBatch(saved.map((s) => s.text));
  for (let i = 0; i < saved.length; i++) {
    await setEmbedding(saved[i].id, vectors[i]);
  }

  return { created, updated };
}
