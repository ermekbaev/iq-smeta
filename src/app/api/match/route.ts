import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
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
});

// POST /api/match — позиции из речи → подбор по прайсу с кандидатами (PLAN 3.2).
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные позиции" }, { status: 400 });
  }

  const results = await Promise.all(
    parsed.data.items.map(async (it) => {
      const m = await matchItem(it.name);
      return { input: it, match: m };
    })
  );

  return NextResponse.json({ ok: true, results });
}
