// Общий промпт и парсер для LLM-извлечения позиций (PLAN 3.4).
// Используется прод-адаптерами (Yandex/GigaChat) — строгий JSON на выход.

import { normalizeUnit } from "@/lib/units";
import { ExtractedItem, Extraction } from "./types";

export const EXTRACT_SYSTEM_PROMPT = `Ты помощник сметчика. Из текста, надиктованного прорабом, извлеки:
1) объект/название сметы — короткий ярлык сметы, если он назван в начале речи: имя объекта или заказчика («смета Павлово 2», «объект ЖК в Кунцево», «смета для ИП Адилет», «заказчик ООО Ромашка», «клиент Иван Петрович», «название полив 6 соток»). Верни как произнесено, сохраняя форму («ИП …», «ООО …»). Это НЕ позиция и НЕ количество товара — в список позиций его НЕ добавляй. Если не назван — null.
2) список позиций (материалы, работы, оборудование, доставка).
Верни СТРОГО JSON-объект вида {"client": string|null, "items": [{"name": string, "qty": number, "unit": string, "price": number|null}]}, без пояснений и без markdown.
- client — объект/название из п.1 (или null)
- name — краткое наименование позиции (без количества, единицы и цены)
- qty — количество числом (если не названо — 1)
- unit — единица измерения как произнесена (мешок, куб, тонна, шт и т.п.)
- price — ЦЕНА ЗА ЕДИНИЦУ в рублях, ТОЛЬКО если прораб явно назвал стоимость этой позиции голосом (например «монтаж узла двадцать тысяч», «по пятьсот рублей»). Число словами переведи в число. Если цена не названа — верни null (не придумывай).
Примеры:
"смета Павлово 2: десять светильников семь ватт и пять дождевателей" →
{"client":"Павлово 2","items":[{"name":"светильник семь ватт","qty":10,"unit":"шт","price":null},{"name":"дождеватель","qty":5,"unit":"шт","price":null}]}
"смета для ИП Адилет: 10 мешков цемента М500 и доставка самосвалом" →
{"client":"ИП Адилет","items":[{"name":"цемент М500","qty":10,"unit":"мешок","price":null},{"name":"доставка самосвалом","qty":1,"unit":"шт","price":null}]}
"выполнение нестандартных работ повышенной сложности двадцать тысяч, и десять форсунок по пятьсот рублей" →
{"client":null,"items":[{"name":"нестандартные работы повышенной сложности","qty":1,"unit":"шт","price":20000},{"name":"форсунка","qty":10,"unit":"шт","price":500}]}`;

/** Разбирает произвольный текст ответа LLM в JSON (снимает markdown, мусор по краям). */
function extractJson(content: string): unknown {
  let text = content.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const candidates: string[] = [text];
  // объект {client, items}
  const os = text.indexOf("{");
  const oe = text.lastIndexOf("}");
  if (os !== -1 && oe > os) candidates.push(text.slice(os, oe + 1));
  // либо голый массив позиций (обратная совместимость со старым форматом)
  const as = text.indexOf("[");
  const ae = text.lastIndexOf("]");
  if (as !== -1 && ae > as) candidates.push(text.slice(as, ae + 1));
  for (const c of candidates) {
    try {
      return JSON.parse(c);
    } catch {
      /* пробуем следующий срез */
    }
  }
  return undefined;
}

function normalizeItems(raw: unknown): ExtractedItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r): ExtractedItem | null => {
      if (typeof r !== "object" || r === null) return null;
      const o = r as Record<string, unknown>;
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

/**
 * Достаёт из ответа LLM заказчика + позиции.
 * Основной формат — объект {client, items}; голый массив (старый формат) тоже
 * поддержан — тогда client = null.
 */
export function parseExtraction(content: string): Extraction {
  const parsed = extractJson(content);
  if (Array.isArray(parsed)) return { client: null, items: normalizeItems(parsed) };
  if (parsed && typeof parsed === "object") {
    const o = parsed as Record<string, unknown>;
    const raw = typeof o.client === "string" ? o.client.trim() : "";
    // отсечь мусор ("null"/"none") и слишком длинные строки
    const client = raw && raw.toLowerCase() !== "null" ? raw.slice(0, 120) : null;
    return { client, items: normalizeItems(o.items) };
  }
  return { client: null, items: [] };
}
