// Разбор прайса Excel/CSV по колонкам (PLAN этап 1).
// Колонки распознаём по заголовкам (рус. синонимы), регистр/пробелы не важны.

import * as XLSX from "xlsx";
import { Category } from "@prisma/client";
import { parseCategory } from "./category";

export interface ParsedRow {
  name: string;
  unit: string;
  price: number;
  category: Category;
}

export interface ParseResult {
  rows: ParsedRow[];
  skipped: number; // строк отброшено (нет названия или цены)
  total: number; // строк данных всего
}

const HEADER_SYNONYMS: Record<keyof Omit<ParsedRow, "category"> | "category", string[]> = {
  name: ["наименование", "название", "позиция", "товар", "материал", "name"],
  unit: ["ед", "ед.", "ед изм", "ед. изм.", "единица", "единица измерения", "unit"],
  price: ["цена", "стоимость", "price", "руб"],
  category: ["категория", "группа", "раздел", "category"],
};

function matchHeader(header: string): keyof ParsedRow | null {
  const h = header.trim().toLowerCase();
  for (const [field, syns] of Object.entries(HEADER_SYNONYMS)) {
    if (syns.some((s) => h === s || h.startsWith(s))) {
      return field as keyof ParsedRow;
    }
  }
  return null;
}

function parsePrice(raw: unknown): number {
  if (typeof raw === "number") return raw;
  const cleaned = String(raw ?? "")
    .replace(/\s/g, "")
    .replace(/[^\d.,-]/g, "")
    .replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

export function parsePriceFile(buf: Buffer, opts?: { csv?: boolean }): ParseResult {
  // CSV декодируем как UTF-8 строку — иначе SheetJS портит кириллицу в заголовках.
  // XLSX читаем как бинарь.
  const wb = opts?.csv
    ? XLSX.read(buf.toString("utf8"), { type: "string" })
    : XLSX.read(buf, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return { rows: [], skipped: 0, total: 0 };

  const matrix: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    blankrows: false,
  });
  if (matrix.length === 0) return { rows: [], skipped: 0, total: 0 };

  // первая непустая строка — заголовки
  const headerRow = matrix[0].map((c) => String(c ?? ""));
  const colMap = new Map<keyof ParsedRow, number>();
  headerRow.forEach((h, i) => {
    const field = matchHeader(h);
    if (field && !colMap.has(field)) colMap.set(field, i);
  });

  const nameCol = colMap.get("name");
  const priceCol = colMap.get("price");
  // без колонок имени/цены прайс разобрать нельзя
  if (nameCol === undefined || priceCol === undefined) {
    return { rows: [], skipped: matrix.length - 1, total: matrix.length - 1 };
  }
  const unitCol = colMap.get("unit");
  const catCol = colMap.get("category");

  const rows: ParsedRow[] = [];
  let skipped = 0;
  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r];
    const name = String(row[nameCol] ?? "").trim();
    const price = parsePrice(row[priceCol]);
    if (!name || !Number.isFinite(price)) {
      skipped++;
      continue;
    }
    rows.push({
      name,
      unit: unitCol !== undefined ? String(row[unitCol] ?? "шт").trim() || "шт" : "шт",
      price,
      category: parseCategory(catCol !== undefined ? row[catCol] : undefined),
    });
  }

  return { rows, skipped, total: matrix.length - 1 };
}
