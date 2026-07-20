// Обзор синонимов всех аккаунтов — только для сопровождающего общей базы.
// Нужен, чтобы выуживать удачные пары в общую базу: одинаковые группы из разных
// аккаунтов схлопываются, сверху — те, которых в общей базе ещё нет.
import { NextResponse } from "next/server";
import { requireGlobalSynonymAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { aggregateReview } from "@/lib/match/synonyms-review";

export const runtime = "nodejs";

export async function GET() {
  const gate = await requireGlobalSynonymAdmin();
  if (gate instanceof NextResponse) return gate;

  const [personal, global] = await Promise.all([
    prisma.synonym.findMany({
      where: { isGlobal: false },
      select: { terms: true, user: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.synonym.findMany({ where: { isGlobal: true }, select: { terms: true } }),
  ]);

  return NextResponse.json(
    aggregateReview(
      personal.map((p) => ({ terms: p.terms, email: p.user?.email ?? null })),
      global.map((g) => g.terms)
    )
  );
}
