// Общий промпт и парсер для LLM-извлечения позиций (PLAN 3.4).
// Используется прод-адаптерами (Yandex/GigaChat) — строгий JSON на выход.

import { normalizeUnit } from "@/lib/units";
import { ExtractedItem } from "./types";

export const EXTRACT_SYSTEM_PROMPT = `Ты помощник сметчика. Из текста, надиктованного прорабом, извлеки список позиций (материалы, работы, оборудование, доставка).
Верни СТРОГО JSON-массив объектов вида {"name": string, "qty": number, "unit": string}, без пояснений и без markdown.
- name — краткое наименование позиции (без количества и единицы)
- qty — количество числом (если не названо — 1)
- unit — единица измерения как произнесена (мешок, куб, тонна, шт и т.п.)
Пример: "10 мешков цемента М500, 3 куба песка и доставка самосвалом" →
[{"name":"цемент М500","qty":10,"unit":"мешок"},{"name":"песок","qty":3,"unit":"куб"},{"name":"доставка самосвалом","qty":1,"unit":"шт"}]`;

/** Достаёт JSON-массив из ответа LLM (срезает markdown-обёртку, мусор по краям). */
export function parseExtraction(content: string): ExtractedItem[] {
  let text = content.trim();
  // снять ```json ... ```
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  // выделить массив по первым/последним скобкам
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start !== -1 && end !== -1) text = text.slice(start, end + 1);

  let arr: unknown;
  try {
    arr = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];

  return arr
    .map((raw): ExtractedItem | null => {
      if (typeof raw !== "object" || raw === null) return null;
      const o = raw as Record<string, unknown>;
      const name = String(o.name ?? "").trim();
      if (!name) return null;
      const qtyNum = Number(o.qty);
      const qty = Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum : 1;
      const unit = normalizeUnit(String(o.unit ?? "шт"));
      return { name, qty, unit };
    })
    .filter((x): x is ExtractedItem => x !== null);
}
