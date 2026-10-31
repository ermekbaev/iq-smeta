// Поиск по разобранному прайсу: npx tsx scripts/price-grep.ts <файл> <подстрока в названии или разделе>
import { readFileSync } from "node:fs";
import { parsePriceFile } from "@/lib/price/parse";
const q = process.argv[3].toLowerCase();
const rows = parsePriceFile(readFileSync(process.argv[2])).rows.filter((r) => (r.name + " " + r.category).toLowerCase().includes(q));
console.log(rows.length);
for (const r of rows.slice(0, 12)) console.log(`${r.category} | ${r.name.slice(0, 90)}`);
