// ИИ-помощник синонимов: подсказать варианты / проверить группу.
// Финальное решение всегда за человеком — этот роут ничего не пишет в БД.
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { rateLimit } from "@/lib/rate-limit";
import { suggestSynonyms, validateSynonymGroup } from "@/lib/match/synonyms-ai";

export const runtime = "nodejs";

const schema = z.union([
  z.object({ action: z.literal("suggest"), term: z.string().min(1).max(80) }),
  z.object({ action: z.literal("validate"), terms: z.array(z.string().max(80)).min(2).max(20) }),
]);

export async function POST(req: Request) {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  const { userId } = gate;

  const rl = rateLimit(`syn-ai:${userId}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Слишком часто, подождите ${rl.retryAfter}с` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Проверьте запрос" }, { status: 400 });

  if (parsed.data.action === "suggest") {
    const suggestions = await suggestSynonyms(parsed.data.term);
    return NextResponse.json({ suggestions });
  }
  const verdict = await validateSynonymGroup(parsed.data.terms);
  return NextResponse.json(verdict);
}
