// Как разобрался файл прайса: npx tsx scripts/price-peek.ts <файл> [фильтр] [направление]
import { readFileSync } from "node:fs";
import { parsePriceFile } from "@/lib/price/parse";
const res = parsePriceFile(readFileSync(process.argv[2]), { direction: process.argv[4] });
const f = (process.argv[3] ?? "").toLowerCase();
console.log("листы:", res.sheets.join(", "), "| позиций", res.rows.length, "| с разделом", res.rows.filter((r) => r.section).length);
for (const r of res.rows.filter((r) => !f || (r.name + r.section).toLowerCase().includes(f)).slice(0, 8))
  console.log(`${r.category} | ${r.section ?? "-"} | ${r.article ?? ""} ${r.name.slice(0, 60)}`);
