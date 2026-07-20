import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { matchItem } from "@/lib/match/matcher";

export const runtime = "nodejs";

const schema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().min(1),
        qty: z.number().positive(),
        unit: z.string().min(1),
      })
    )
    .min(1),
  // сузить подбор до раздела прайса («бери из дренажа» или выбор вручную)
  category: z.string().min(1).max(120).optional(),
});

// POST /api/match — позиции из речи → подбор по прайсу с кандидатами (PLAN 3.2).
export async function POST(req: Request) {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  const { userId } = gate;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные позиции" }, { status: 400 });
  }

  const { items, category } = parsed.data;
  const results = await Promise.all(
    items.map(async (it) => {
      const m = await matchItem(userId, it.name, category);
      return { input: it, match: m };
    })
  );

  return NextResponse.json({ ok: true, results });
}
