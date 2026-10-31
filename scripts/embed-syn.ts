// Проверка синонимов: короткое слово мастера + «прайсовые» названия → подбор документной моделью
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fuzzyScore } from "@/lib/match/fuzzy";
import { applySynonyms } from "@/lib/match/synonyms";
import { isWorkCategory } from "@/lib/estimate/service";
const EMB = "https://llm.api.cloud.yandex.net/foundationModels/v1/textEmbedding";
const key = process.env.YANDEX_API_KEY!, folder = process.env.YANDEX_FOLDER_ID!;
async function emb(text: string): Promise<number[]> {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(EMB, { method: "POST", headers: { Authorization: `Api-Key ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ modelUri: `emb://${folder}/text-search-doc/latest`, text }) });
    if (r.ok) return ((await r.json()) as { embedding: number[] }).embedding;
    await new Promise((s) => setTimeout(s, 1500 * (i + 1)));
  }
  throw new Error("emb fail");
}
const cos = (a: number[], b: number[]) => { let d = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; } return d / Math.sqrt(x * y); };
const cachePath = process.argv[2];
const cache: Record<string, number[]> = JSON.parse(readFileSync(cachePath, "utf8"));
const items: { text: string; name: string }[] = JSON.parse(readFileSync(cachePath.replace(/\.json$/, ".items.json"), "utf8"));
export const GROUPS = JSON.parse(readFileSync(process.argv[3], "utf8")) as string[][];
const Q = (process.argv[4] ?? "").split("|").filter(Boolean);
(async () => {
  for (const q of Q) {
    const ex = applySynonyms(GROUPS, q);
    const v = await emb(ex); await new Promise((s) => setTimeout(s, 1100));
    const ask = isWorkCategory(q);
    const top = items.map((it) => { const base = 0.8 * cos(v, cache["doc:" + it.text]) + 0.2 * Math.max(fuzzyScore(q, it.name), fuzzyScore(ex, it.name)); return { it, s: isWorkCategory(it.name) === ask ? base : base * 0.85 }; })
      .sort((a, b) => b.s - a.s).slice(0, 2).map((x) => `${x.s.toFixed(2)} ${x.it.name.slice(0, 60)}`).join("  ||  ");
    console.log(`«${q}»${ex !== q ? " +син" : ""}\n   ${top}`);
  }
})();
