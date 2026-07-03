// Разбор прайса Excel/CSV (PLAN этап 1 + реальный формат заказчика).
//
// Поддерживает и простые плоские таблицы (наш формат), и реальные прайсы:
//  - несколько листов (по брендам/поставщикам);
//  - заголовок не в первой строке (сверху реквизиты компании);
//  - строки-разделы внутри данных («Светильники», «Ёмкости») → категория;
//  - несколько колонок цены: РРЦ (розница → price) и ОПТ (закупка → cost);
//  - колонка артикула; колонка фото игнорируется.
// Лист-смета (есть колонка «Кол-во») пропускается — берём только каталоги.

import * as XLSX from "xlsx";

export interface ParsedRow {
  article: string | null;
  name: string;
  unit: string;
  price: number; // РРЦ (розница)
  cost: number | null; // ОПТ (закупка) — для маржи
  category: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  skipped: number;
  total: number;
  sheets: string[]; // какие листы разобраны как каталоги
}

type Col = "name" | "unit" | "price" | "cost" | "article" | "category" | "qty";

// Синонимы заголовков. price = РРЦ (розница), cost = ОПТ (закупка).
function matchCol(header: string): Col | null {
  const h = header.trim().toLowerCase();
  if (!h) return null;
  if (/фото|изображ|картинк/.test(h)) return null; // колонка с картинкой — не «товар»
  if (/наименован|назван|товар|позиц/.test(h)) return "name";
  if (/артикул|код/.test(h)) return "article";
  if (/кол-?во|колич/.test(h)) return "qty";
  if (/^ед|единиц/.test(h)) return "unit";
  if (/категор|группа|раздел/.test(h)) return "category";
  // ОПТ/закупка (но не «оптовая скидка»)
  if ((/опт|закуп/.test(h)) && !/скидк/.test(h)) return "cost";
  // розница
  if (/ррц|розн/.test(h)) return "price";
  if (/цена|стоимост/.test(h) && !/сумма/.test(h)) return "price";
  return null;
}

function parseNum(raw: unknown): number {
  if (typeof raw === "number") return raw;
  const cleaned = String(raw ?? "")
    .replace(/\s| /g, "")
    .replace(/[^\d.,-]/g, "")
    .replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

interface ColMap {
  headerRow: number;
  cols: Partial<Record<Col, number>>;
}

// Ищем строку заголовков (содержит «наименование» + любую цену) в первых 20 строках.
function findHeader(matrix: unknown[][]): ColMap | null {
  const limit = Math.min(matrix.length, 20);
  for (let r = 0; r < limit; r++) {
    const cells = matrix[r].map((c) => String(c ?? ""));
    const cols: Partial<Record<Col, number>> = {};
    cells.forEach((h, i) => {
      const col = matchCol(h);
      if (col && cols[col] === undefined) cols[col] = i;
    });
    if (cols.name !== undefined && cols.price !== undefined) {
      return { headerRow: r, cols };
    }
  }
  return null;
}

function parseSheet(matrix: unknown[][], rows: ParsedRow[]): { skipped: number; total: number } | null {
  const hdr = findHeader(matrix);
  if (!hdr) return null; // нет заголовка — не каталог
  // лист-смета (есть «кол-во») пропускаем целиком
  if (hdr.cols.qty !== undefined) return null;

  const c = hdr.cols;
  const nameCol = c.name!;
  const priceCol = c.price!;
  // плоский режим (колонка категории есть) vs режим разделов (её нет)
  const flat = c.category !== undefined;
  let skipped = 0;
  let total = 0;
  let currentCategory = "Прочее";

  for (let r = hdr.headerRow + 1; r < matrix.length; r++) {
    const row = matrix[r];
    const name = String(row[nameCol] ?? "").trim();
    if (!name) continue;

    const price = parseNum(row[priceCol]);
    const article =
      c.article !== undefined ? String(row[c.article] ?? "").trim() || null : null;
    const hasPrice = Number.isFinite(price) && price > 0;

    // режим разделов: строка без цены и артикула — это заголовок раздела
    if (!flat && !hasPrice && !article) {
      currentCategory = name;
      continue;
    }

    total++;
    if (!hasPrice) {
      skipped++;
      continue;
    }

    const category = flat
      ? String(row[c.category!] ?? "").trim() || "Прочее"
      : currentCategory;

    const cost =
      c.cost !== undefined && Number.isFinite(parseNum(row[c.cost]))
        ? parseNum(row[c.cost])
        : null;

    rows.push({
      article,
      name,
      unit: c.unit !== undefined ? String(row[c.unit] ?? "шт").trim() || "шт" : "шт",
      price,
      cost: cost && cost > 0 ? cost : null,
      category,
    });
  }
  return { skipped, total };
}

export function parsePriceFile(buf: Buffer, opts?: { csv?: boolean }): ParseResult {
  const wb = opts?.csv
    ? XLSX.read(buf.toString("utf8"), { type: "string" })
    : XLSX.read(buf, { type: "buffer" });

  const rows: ParsedRow[] = [];
  const sheets: string[] = [];
  let skipped = 0;
  let total = 0;

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const matrix: unknown[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      blankrows: false,
    });
    const res = parseSheet(matrix, rows);
    if (res) {
      sheets.push(name);
      skipped += res.skipped;
      total += res.total;
    }
  }

  return { rows, skipped, total, sheets };
}
