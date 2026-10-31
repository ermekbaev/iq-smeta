// Сравнение моделей эмбеддингов Яндекса на прайсах (офлайн, без базы):
// npx tsx scripts/embed-experiment.ts <out.json> <прайс.xlsx>...
import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { parsePriceFile } from "@/lib/price/parse";

const EMB = "https://llm.api.cloud.yandex.net/foundationModels/v1/textEmbedding";
const key = process.env.YANDEX_API_KEY!, folder = process.env.YANDEX_FOLDER_ID!;
async function emb(text: string, model: string): Promise<number[]> {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(EMB, { method: "POST", headers: { Authorization: `Api-Key ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ modelUri: `emb://${folder}/${model}/latest`, text }) });
    if (r.ok) return ((await r.json()) as { embedding: number[] }).embedding;
    await new Promise((s) => setTimeout(s, 1500 * (i + 1)));
  }
  throw new Error("emb fail");
}
const out = process.argv[2];
const cache: Record<string, number[]> = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : {};
const items: { text: string; name: string; section: string | null }[] = [];
for (const f of process.argv.slice(3)) for (const r of parsePriceFile(readFileSync(f)).rows) {
  items.push({ name: r.name, section: r.section, text: [r.article, r.name, r.section && r.section !== r.category ? r.section : null].filter(Boolean).join(" — ") });
}
(async () => {
  let n = 0;
  for (const it of items) {
    if (cache["doc:" + it.text]) continue;
    cache["doc:" + it.text] = await emb(it.text, "text-search-doc");
    if (++n % 25 === 0) { writeFileSync(out, JSON.stringify(cache)); console.log("doc", n); }
    await new Promise((s) => setTimeout(s, 1100));
  }
  writeFileSync(out, JSON.stringify(cache));
  writeFileSync(out.replace(/\.json$/, ".items.json"), JSON.stringify(items));
  console.log("готово", items.length);
})();
