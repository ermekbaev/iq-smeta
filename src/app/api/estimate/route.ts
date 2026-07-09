import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { createEstimate } from "@/lib/estimate/service";

export const runtime = "nodejs";

const lineSchema = z.object({
  spokenText: z.string().optional(),
  priceItemId: z.string().nullable().optional(),
  name: z.string().min(1),
  qty: z.number().positive(),
  unit: z.string().min(1),
  price: z.number().nonnegative(),
  category: z.string().min(1).default("Прочее"),
});

const schema = z.object({
  title: z.string().min(1),
  objectName: z.string().nullable().optional(),
  subject: z.string().max(300).nullable().optional(),
  clientName: z.string().nullable().optional(),
  // логотип КП — data URL (ограничиваем размер, чтобы не раздувать запрос)
  logo: z.string().max(4_000_000).nullable().optional(),
  lines: z.array(lineSchema).min(1),
});

// POST /api/estimate — сохранить собранную смету (+ зафиксировать aliases).
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте поля сметы" }, { status: 400 });
  }

  const { id } = await createEstimate(session.user.id, parsed.data);
  return NextResponse.json({ ok: true, id });
}
