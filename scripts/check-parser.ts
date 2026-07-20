// Разовая регрессия парсера на реальных шаблонах заказчика (client-files/, не в git).
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parsePriceFile } from "../src/lib/price/parse";

const DIR = "client-files";

if (!existsSync(DIR)) {
  console.log(`Папки ${DIR}/ нет — положите в неё файлы прайсов (она не в git).`);
  process.exit(0);
}

for (const f of readdirSync(DIR).filter((f) => /\.(xlsx|xls)$/i.test(f))) {
  const buf = readFileSync(join(DIR, f));
  try {
    const r = parsePriceFile(buf);
    const bad = r.rows.filter((x) => !x.name || !(x.price > 0));
    const units = new Set(r.rows.map((x) => x.unit));
    console.log(
      `${r.rows.length === 0 ? "✗" : "✓"} ${f}\n` +
        `    позиций: ${r.rows.length}, пропущено: ${r.skipped}, листы: ${r.sheets.join(" | ") || "—"}\n` +
        `    мусор (без имени/цены): ${bad.length}, единиц: ${[...units].slice(0, 8).join(", ")}`
    );
    // выборочно первая строка — глазами видно, что колонки не съехали
    if (r.rows[0]) {
      const x = r.rows[0];
      console.log(`    пример: «${x.name}» ${x.price} ₽/${x.unit} [${x.category}]`);
    }
  } catch (e) {
    console.log(`✗ ${f} — ИСКЛЮЧЕНИЕ: ${(e as Error).message}`);
  }
}
