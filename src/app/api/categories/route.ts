// Категории прайса аккаунта — для фильтра подбора и панели прайса.
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  const { userId } = gate;

  const rows = await prisma.priceItem.groupBy({
    by: ["category"],
    where: { userId },
    _count: { _all: true },
    orderBy: { category: "asc" },
  });

  return NextResponse.json(
    rows.map((r) => ({ category: r.category, count: r._count._all }))
  );
}
