// Разбор прайса Excel/CSV (PLAN этап 1 + реальные форматы заказчика).
//
// Поддерживает:
//  - простые плоские таблицы (наш формат);
//  - реальные прайсы (несколько листов, заголовок не в первой строке,
//    строки-разделы → категория, колонки РРЦ/ОПТ, артикул, колонка фото);
//  - шаблоны СМЕТ заказчика (есть «Кол-во» и «Итого» — их игнорим, берём
//    Наименование/Ед./Цена; подытоги «Итого/Всего/Накладные» пропускаем;
//    лист «Расходники» пропускаем).
// «Направление» при загрузке файла становится категорией всех его позиций.

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
  if (/опт|закуп/.test(h) && !/скидк/.test(h)) return "cost";
  // розница
  if (/ррц|розн/.test(h)) return "price";
  if (/цена|стоимост/.test(h) && !/сумма|итог/.test(h)) return "price";
  return null;
}

function parseNum(raw: unknown): number {
  if (typeof raw === "number") return raw;
  const cleaned = String(raw ?? "")
    .replace(/\s| /g, "")
    .replace(/[^\d.,-]/g, "")
    .replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

// Строка-итог/накладные — не позиция и не раздел, пропускаем целиком.
function isSummaryRow(name: string): boolean {
  return /^\s*(итого|всего|в\s*том\s*числе|накладн|подытог)/i.test(name);
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

function parseSheet(
  matrix: unknown[][],
  rows: ParsedRow[],
  direction?: string
): { skipped: number; total: number } | null {
  const hdr = findHeader(matrix);
  if (!hdr) return null; // нет заголовка — не каталог

  const c = hdr.cols;
  const nameCol = c.name!;
  const priceCol = c.price!;
  // категория позиции: направление (при загрузке) → колонка «категория» → раздел-строка
  const flat = c.category !== undefined;
  let skipped = 0;
  let total = 0;
  let currentCategory = "Прочее";

  for (let r = hdr.headerRow + 1; r < matrix.length; r++) {
    const row = matrix[r];
    const name = String(row[nameCol] ?? "").trim();
    if (!name) continue;
    if (isSummaryRow(name)) continue; // «Итого по…», «Всего», «Накладные» — мимо

    const price = parseNum(row[priceCol]);
    const article =
      c.article !== undefined ? String(row[c.article] ?? "").trim() || null : null;
    const hasPrice = Number.isFinite(price) && price > 0;

    // в режиме разделов строка без цены и артикула — заголовок раздела
    if (!flat && !hasPrice && !article) {
      if (!direction) currentCategory = name; // раздел → категория (если направление не задано)
      continue;
    }

    total++;
    if (!hasPrice) {
      skipped++;
      continue;
    }

    const category = direction
      ? direction
      : flat
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

export function parsePriceFile(
  buf: Buffer,
  opts?: { csv?: boolean; direction?: string }
): ParseResult {
  const wb = opts?.csv
    ? XLSX.read(buf.toString("utf8"), { type: "string" })
    : XLSX.read(buf, { type: "buffer" });

  const direction = opts?.direction?.trim() || undefined;

  // 1) собираем листы-каталоги (с заголовком), помечаем «есть Кол-во» = лист-смета
  const candidates: { name: string; matrix: unknown[][]; isEstimate: boolean }[] = [];
  for (const name of wb.SheetNames) {
    if (/расходник/i.test(name)) continue; // внутренние расходники/инструмент — не каталог
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const matrix: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
    const hdr = findHeader(matrix);
    if (!hdr) continue;
    candidates.push({ name, matrix, isEstimate: hdr.cols.qty !== undefined });
  }

  // 2) если в файле есть «чистый» прайс (без Кол-во) — листы-сметы пропускаем;
  //    если ВСЕ листы сметы (шаблоны заказчика) — парсим их (берём Наименование/Ед./Цена)
  const hasCleanPrice = candidates.some((s) => !s.isEstimate);

  const rows: ParsedRow[] = [];
  const sheets: string[] = [];
  let skipped = 0;
  let total = 0;

  for (const s of candidates) {
    if (s.isEstimate && hasCleanPrice) continue;
    const res = parseSheet(s.matrix, rows, direction);
    if (res) {
      sheets.push(s.name);
      skipped += res.skipped;
      total += res.total;
    }
  }

  return { rows, skipped, total, sheets };
}
