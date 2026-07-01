import { Category } from "@prisma/client";

// Текст категории из прайса → enum. Неизвестное по умолчанию — Материалы.
const MAP: Record<string, Category> = {
  материал: Category.MATERIALS,
  материалы: Category.MATERIALS,
  работа: Category.WORKS,
  работы: Category.WORKS,
  оборудование: Category.EQUIPMENT,
  доставка: Category.DELIVERY,
  логистика: Category.DELIVERY,
  издержки: Category.OVERHEAD,
  накладные: Category.OVERHEAD,
  прочее: Category.OVERHEAD,
};

export function parseCategory(raw: unknown): Category {
  const key = String(raw ?? "").trim().toLowerCase();
  return MAP[key] ?? Category.MATERIALS;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  MATERIALS: "Материалы",
  WORKS: "Работы",
  EQUIPMENT: "Оборудование",
  DELIVERY: "Доставка",
  OVERHEAD: "Издержки",
};
