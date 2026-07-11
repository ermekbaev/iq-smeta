// Работа с векторной колонкой price_items.embedding через raw SQL
// (Prisma не пишет Unsupported-поля напрямую). См. PLAN 3.2.

import { prisma } from "@/lib/prisma";

/** number[] → литерал pgvector: '[0.1,0.2,...]' */
export function toSqlVector(v: number[]): string {
  return `[${v.join(",")}]`;
}

/** Записать/обновить эмбеддинг позиции. */
export async function setEmbedding(id: string, vector: number[]): Promise<void> {
  await prisma.$executeRaw`
    UPDATE price_items
    SET embedding = ${toSqlVector(vector)}::vector
    WHERE id = ${id}
  `;
}

export interface MatchCandidate {
  id: string;
  name: string;
  unit: string;
  price: string;
  category: string;
  distance: number; // косинусное расстояние (0 = идентично)
}

/**
 * Семантический подбор ближайших позиций прайса (PLAN 3.2, слой 1).
 * Возвращает кандидатов, отсортированных по близости.
 */
export async function searchSimilar(
  userId: string,
  vector: number[],
  limit = 5
): Promise<MatchCandidate[]> {
  const vec = toSqlVector(vector);
  return prisma.$queryRaw<MatchCandidate[]>`
    SELECT id, name, unit, price::text AS price, category::text AS category,
           embedding <=> ${vec}::vector AS distance
    FROM price_items
    WHERE user_id = ${userId} AND embedding IS NOT NULL
    ORDER BY embedding <=> ${vec}::vector
    LIMIT ${limit}
  `;
}
