// Как прайсы раскладываются по услугам — проверка без базы:
// npx tsx scripts/services-report.ts <файл.xlsx> [...]
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { parsePriceFile } from "@/lib/price/parse";
import { SERVICES, mapCategories, scopeIds, serviceCounts, serviceOfText } from "@/lib/services";

const all: { id: string; category: string; name: string }[] = [];
for (const f of process.argv.slice(2)) {
  const res = parsePriceFile(readFileSync(f));
  console.log(`# ${basename(f)} — позиций ${res.rows.length}`);
  res.rows.forEach((r, i) => all.push({ id: `${basename(f)}#${i}`, category: r.category, name: r.name }));
}
const map = mapCategories(all);
console.log("\nРАЗДЕЛ → УСЛУГА");
const n = new Map<string, number>();
for (const it of all) n.set(it.category, (n.get(it.category) ?? 0) + 1);
[...map].sort((a, b) => (n.get(b[0]) ?? 0) - (n.get(a[0]) ?? 0)).forEach(([c, s]) => console.log(`${(s?.label ?? "— общее —").padEnd(20)} ${String(n.get(c)).padStart(4)}  ${c}`));
const counts = serviceCounts(all);
console.log("\nУСЛУГА: своих позиций / всего в подборе (+общее без услуги)");
for (const s of SERVICES) {
  if (!counts.get(s.id)) continue;
  const ids = new Set(scopeIds(all, s.id));
  const own = all.filter((it) => ids.has(it.id) && (map.get(it.category) ?? serviceOfText(it.name))?.id === s.id);
  console.log(`${s.label.padEnd(20)} ${String(own.length).padStart(4)} / ${ids.size}`);
}
