import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { createEstimate } from "@/lib/estimate/service";

export const runtime = "nodejs";

const lineSchema = z.object({
  spokenText: z.string().optional(),
  priceItemId: z.string().nullable().optional(),
  learn: z.boolean().optional(),
  name: z.string().min(1),
  qty: z.number().positive(),
  unit: z.string().min(1),
  price: z.number().nonnegative(),
  // пустую/пробельную категорию не отвергаем, а нормализуем в «Прочее»
  category: z
    .string()
    .optional()
    .transform((c) => (c && c.trim() ? c.trim() : "Прочее")),
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
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  const { userId } = gate;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    // покажем, какое поле не прошло, — иначе 400 немой и не отладить
    const issue = parsed.error.issues[0];
    const where = issue?.path.join(".") || "поля";
    return NextResponse.json(
      { error: `Проверьте поля сметы (${where}: ${issue?.message ?? "ошибка"})` },
      { status: 400 }
    );
  }

  const { id } = await createEstimate(userId, parsed.data);
  return NextResponse.json({ ok: true, id });
}
