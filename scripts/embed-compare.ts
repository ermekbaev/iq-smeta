// Сравнение: фраза запросной/документной моделью и их смесь против векторов прайса из embed-experiment
// npx tsx scripts/embed-compare.ts <cache.json>
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fuzzyScore } from "@/lib/match/fuzzy";

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
const cos = (a: number[], b: number[]) => {
  let d = 0, x = 0, y = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; }
  return d / Math.sqrt(x * y);
};
const cachePath = process.argv[2];
const cache: Record<string, number[]> = JSON.parse(readFileSync(cachePath, "utf8"));
const items: { text: string; name: string }[] = JSON.parse(readFileSync(cachePath.replace(/\.json$/, ".items.json"), "utf8"));
const Q = ["форсунка", "капельная трубка", "контроллер на шесть зон", "электромагнитный клапан", "датчик дождя", "насос", "дождеватель роторный",
  "спот", "трансформатор на 300 ватт", "кабель", "столбик", "настенный светильник", "светильник грунтовый", "монтаж светильника", "монтаж столбика", "светильник подводный", "блок питания", "колоски"];
(async () => {
  for (const q of Q) {
    const qd = await emb(q, "text-search-doc"); await new Promise((s) => setTimeout(s, 1100));
    const qq = await emb(q, "text-search-query"); await new Promise((s) => setTimeout(s, 1100));
    const rank = (f: (v: number[], name: string) => number) =>
      items.map((it) => ({ it, s: f(cache["doc:" + it.text], it.name) })).sort((a, b) => b.s - a.s).slice(0, 3)
        .map((x) => `${x.s.toFixed(2)} ${x.it.name.slice(0, 55)}`).join("  ||  ");
    console.log(`\n«${q}»`);
    console.log("  DOC  ", rank((v, n) => 0.8 * cos(qd, v) + 0.2 * fuzzyScore(q, n)));
    console.log("  QUERY", rank((v, n) => 0.8 * cos(qq, v) + 0.2 * fuzzyScore(q, n)));
  }
})();
