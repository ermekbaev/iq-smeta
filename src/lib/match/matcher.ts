// Умный подбор позиции прайса по тексту из речи (PLAN 3.2).
// Слои: 1) aliases (точное сопоставление, выученное правкой) →
//        2) семантика (pgvector) + 3) нечёткое сравнение → уверенность с порогом.

import { prisma } from "@/lib/prisma";
import { ai } from "@/lib/ai";
import { searchSimilar } from "./index";
import { fuzzyScore, normalizeText } from "./fuzzy";

// Настройки подбора — через env, чтобы тюнить без правок кода (PLAN 3.2).
// Порог автоподбора: выше — берём молча, ниже — спрашиваем подтверждение.
export const CONFIDENCE_THRESHOLD = numEnv("MATCH_THRESHOLD", 0.6);

// Вес семантики vs нечёткого сравнения. С реальными эмбеддингами семантика
// сильнее (ловит разные формулировки), поэтому по умолчанию её вес выше.
const W_SEMANTIC = numEnv("MATCH_W_SEMANTIC", 0.7);
const W_FUZZY = numEnv("MATCH_W_FUZZY", 0.3);

function numEnv(name: string, def: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 ? v : def;
}

export interface Candidate {
  id: string;
  name: string;
  unit: string;
  price: number;
  category: string;
  score: number; // 0..1
}

export interface MatchResult {
  query: string;
  best: Candidate | null;
  candidates: Candidate[];
  confidence: number;
  needsConfirm: boolean;
  source: "alias" | "auto" | "none";
}

export async function matchItem(name: string): Promise<MatchResult> {
  const normalized = normalizeText(name);

  // Слой 1 — выученное сопоставление
  const alias = await prisma.alias.findUnique({
    where: { spokenText: normalized },
    include: {
      priceItem: {
        select: { id: true, name: true, unit: true, price: true, category: true },
      },
    },
  });
  if (alias) {
    const p = alias.priceItem;
    const best: Candidate = {
      id: p.id,
      name: p.name,
      unit: p.unit,
      price: Number(p.price),
      category: p.category,
      score: 1,
    };
    return {
      query: name,
      best,
      candidates: [best],
      confidence: 1,
      needsConfirm: false,
      source: "alias",
    };
  }

  // Слой 2+3 — семантика + нечёткое
  const vector = await ai.embeddings.embed(name);
  const raw = await searchSimilar(vector, 5);

  const candidates: Candidate[] = raw
    .map((c) => {
      const semantic = Math.max(0, 1 - c.distance); // косинус: distance 0 = идентично
      const fuzzy = fuzzyScore(name, c.name);
      const score = (W_SEMANTIC * semantic + W_FUZZY * fuzzy) / (W_SEMANTIC + W_FUZZY);
      return {
        id: c.id,
        name: c.name,
        unit: c.unit,
        price: Number(c.price),
        category: c.category,
        score,
      };
    })
    .sort((a, b) => b.score - a.score);

  const best = candidates[0] ?? null;
  const confidence = best?.score ?? 0;

  return {
    query: name,
    best,
    candidates,
    confidence,
    needsConfirm: !best || confidence < CONFIDENCE_THRESHOLD,
    source: best ? "auto" : "none",
  };
}
