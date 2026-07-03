// Сборка и сохранение сметы (PLAN этап 2).
// Попутно фиксируем правки в aliases — простое «обучение» (PLAN 3.3).

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeText } from "@/lib/match/fuzzy";

export interface DraftLine {
  /** Текст из речи — для записи alias (обучение подбора). */
  spokenText?: string;
  /** Подобранная позиция прайса; null — заведена вручную. */
  priceItemId?: string | null;
  name: string;
  qty: number;
  unit: string;
  price: number;
  /** Раздел/группа (свободный текст, из прайса заказчика). */
  category: string;
}

export interface CreateEstimateInput {
  title: string;
  clientName?: string | null;
  lines: DraftLine[];
}

export async function createEstimate(
  userId: string,
  input: CreateEstimateInput
): Promise<{ id: string }> {
  const items = input.lines.map((l) => {
    const sum = round2(l.qty * l.price);
    return { line: l, sum };
  });
  const total = round2(items.reduce((acc, i) => acc + i.sum, 0));

  return prisma.$transaction(async (tx) => {
    const estimate = await tx.estimate.create({
      data: {
        userId,
        title: input.title,
        clientName: input.clientName ?? null,
        total,
        items: {
          create: items.map(({ line, sum }) => ({
            priceItemId: line.priceItemId ?? null,
            name: line.name,
            qty: line.qty,
            unit: line.unit,
            price: line.price,
            sum,
            category: line.category,
          })),
        },
      },
      select: { id: true },
    });

    // Обучение: сказанный текст → выбранная позиция. «Последняя правка побеждает».
    for (const { line } of items) {
      if (line.priceItemId && line.spokenText) {
        const spoken = normalizeText(line.spokenText);
        if (spoken) {
          await tx.alias.upsert({
            where: { spokenText: spoken },
            create: { spokenText: spoken, priceItemId: line.priceItemId },
            update: { priceItemId: line.priceItemId },
          });
        }
      }
    }

    return estimate;
  });
}

export interface UpdateEstimateInput {
  title: string;
  clientName?: string | null;
  lines: DraftLine[];
}

/** Полное обновление сметы: заголовок, заказчик и состав позиций (с пересчётом итога). */
export async function updateEstimate(
  id: string,
  input: UpdateEstimateInput
): Promise<void> {
  const items = input.lines.map((l) => ({ line: l, sum: round2(l.qty * l.price) }));
  const total = round2(items.reduce((acc, i) => acc + i.sum, 0));

  await prisma.$transaction(async (tx) => {
    // позиции заменяем целиком — проще и предсказуемее для ручной правки
    await tx.estimateItem.deleteMany({ where: { estimateId: id } });
    await tx.estimate.update({
      where: { id },
      data: {
        title: input.title,
        clientName: input.clientName ?? null,
        total,
        items: {
          create: items.map(({ line, sum }) => ({
            priceItemId: line.priceItemId ?? null,
            name: line.name,
            qty: line.qty,
            unit: line.unit,
            price: line.price,
            sum,
            category: line.category,
          })),
        },
      },
    });
  });
}

export async function deleteEstimate(id: string): Promise<void> {
  await prisma.estimate.delete({ where: { id } });
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface EstimateLineView {
  article: string | null;
  name: string;
  qty: number;
  unit: string;
  price: number;
  sum: number;
}

export interface EstimateGroup {
  category: string;
  label: string;
  isWork: boolean; // раздел относится к работам (для раздельного ИТОГО)
  lines: EstimateLineView[];
  subtotal: number;
}

/** Относится ли раздел к работам/услугам (для итога «Работы» отдельно от оборудования). */
export function isWorkCategory(category: string): boolean {
  return /работ|услуг|монтаж|доставк|накладн|земляны|транш|пусконаладк/i.test(category);
}

/**
 * Группировка позиций сметы по категориям для отображения и PDF (PLAN 3.5).
 * Категории — свободный текст (группы из прайса); порядок по первому появлению.
 */
export function groupByCategory(
  items: {
    article?: string | null;
    name: string;
    qty: Prisma.Decimal | number;
    unit: string;
    price: Prisma.Decimal | number;
    sum: Prisma.Decimal | number;
    category: string;
  }[]
): EstimateGroup[] {
  const map = new Map<string, EstimateLineView[]>();
  for (const it of items) {
    const cat = it.category || "Прочее";
    const line: EstimateLineView = {
      article: it.article ?? null,
      name: it.name,
      qty: Number(it.qty),
      unit: it.unit,
      price: Number(it.price),
      sum: Number(it.sum),
    };
    const arr = map.get(cat) ?? [];
    arr.push(line);
    map.set(cat, arr);
  }
  // Map сохраняет порядок вставки → разделы идут как в прайсе
  return Array.from(map.entries()).map(([category, lines]) => ({
    category,
    label: category,
    isWork: isWorkCategory(category),
    lines,
    subtotal: round2(lines.reduce((a, l) => a + l.sum, 0)),
  }));
}
