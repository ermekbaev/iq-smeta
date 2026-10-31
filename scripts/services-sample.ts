// Примеры позиций общих разделов и их услуга по названию: npx tsx scripts/services-sample.ts <файл> [...]
import { readFileSync } from "node:fs";
import { parsePriceFile } from "@/lib/price/parse";
import { serviceOfText } from "@/lib/services";
const want = new Set(["Прочее", "Выполнение работ", "Соединения", "Материалы", "Инженерные работы", "Насосное оборудование", "Ёмкости"]);
const stat = new Map<string, Map<string, number>>();
const none: string[] = [];
for (const f of process.argv.slice(2)) for (const r of parsePriceFile(readFileSync(f)).rows) {
  if (!want.has(r.category)) continue;
  const s = serviceOfText(r.name)?.label ?? "—";
  const m = stat.get(r.category) ?? new Map(); m.set(s, (m.get(s) ?? 0) + 1); stat.set(r.category, m);
  if (s === "—" && none.length < 400) none.push(`${r.category} | ${r.name}`);
}
for (const [c, m] of stat) console.log(c, JSON.stringify(Object.fromEntries(m)));
console.log("--- без услуги ---"); console.log(none.join("\n"));
