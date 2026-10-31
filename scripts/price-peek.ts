// Как разобрался файл прайса: npx tsx scripts/price-peek.ts <файл> [фильтр раздела]
import { readFileSync } from "node:fs";
import { parsePriceFile } from "@/lib/price/parse";
const res = parsePriceFile(readFileSync(process.argv[2]));
const f = (process.argv[3] ?? "").toLowerCase();
console.log("листы:", res.sheets.join(", "), "| позиций", res.rows.length);
for (const r of res.rows.filter((r) => !f || r.category.toLowerCase().includes(f)).slice(0, 25)) console.log(`${r.category} | ${r.name} | ${r.unit} | ${r.price}${r.article ? " | арт " + r.article : ""}`);
