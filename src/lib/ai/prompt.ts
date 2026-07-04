// Общий промпт и парсер для LLM-извлечения позиций (PLAN 3.4).
// Используется прод-адаптерами (Yandex/GigaChat) — строгий JSON на выход.

import { normalizeUnit } from "@/lib/units";
import { ExtractedItem } from "./types";

export const EXTRACT_SYSTEM_PROMPT = `Ты помощник сметчика. Из текста, надиктованного прорабом, извлеки список позиций (материалы, работы, оборудование, доставка).
Верни СТРОГО JSON-массив объектов вида {"name": string, "qty": number, "unit": string, "price": number|null}, без пояснений и без markdown.
- name — краткое наименование позиции (без количества, единицы и цены)
- qty — количество числом (если не названо — 1)
- unit — единица измерения как произнесена (мешок, куб, тонна, шт и т.п.)
- price — ЦЕНА ЗА ЕДИНИЦУ в рублях, ТОЛЬКО если прораб явно назвал стоимость этой позиции голосом (например «монтаж узла двадцать тысяч», «по пятьсот рублей»). Число словами переведи в число. Если цена не названа — верни null (не придумывай).
Примеры:
"10 мешков цемента М500 и доставка самосвалом" →
[{"name":"цемент М500","qty":10,"unit":"мешок","price":null},{"name":"доставка самосвалом","qty":1,"unit":"шт","price":null}]
"выполнение нестандартных работ повышенной сложности двадцать тысяч, и десять форсунок по пятьсот рублей" →
[{"name":"нестандартные работы повышенной сложности","qty":1,"unit":"шт","price":20000},{"name":"форсунка","qty":10,"unit":"шт","price":500}]`;

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
      // произнесённая цена (необязательно) — только положительное число
      const priceNum = Number(o.price);
      const price = Number.isFinite(priceNum) && priceNum > 0 ? priceNum : undefined;
      return price !== undefined ? { name, qty, unit, price } : { name, qty, unit };
    })
    .filter((x): x is ExtractedItem => x !== null);
}
