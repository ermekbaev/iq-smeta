// Виды позиций прайса: раздел → примеры названий (для составления синонимов)
import { readFileSync } from "node:fs";
import { parsePriceFile } from "@/lib/price/parse";
for (const f of process.argv.slice(2)) {
  const by = new Map<string, string[]>();
  for (const r of parsePriceFile(readFileSync(f)).rows) {
    const k = r.section ?? r.category;
    const l = by.get(k) ?? []; l.push(r.name.split(/\r?\n/)[0].slice(0, 70)); by.set(k, l);
  }
  for (const [k, l] of by) console.log(`## ${k} (${l.length})\n  ` + [...new Set(l.map((n) => n.replace(/[\d.,*×"'¾½¼()\/\-]+/g, " ").split(/\s+/).slice(0, 4).join(" ")))].slice(0, 8).join(" | "));
}
