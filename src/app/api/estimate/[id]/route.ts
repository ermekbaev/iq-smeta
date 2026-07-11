import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { deleteEstimate, updateEstimate } from "@/lib/estimate/service";

export const runtime = "nodejs";

const lineSchema = z.object({
  priceItemId: z.string().nullable().optional(),
  name: z.string().min(1),
  qty: z.number().positive(),
  unit: z.string().min(1),
  price: z.number().nonnegative(),
  category: z.string().min(1).default("Прочее"),
});

const updateSchema = z.object({
  title: z.string().min(1),
  objectName: z.string().nullable().optional(),
  subject: z.string().max(300).nullable().optional(),
  clientName: z.string().nullable().optional(),
  logo: z.string().max(4_000_000).nullable().optional(),
  lines: z.array(lineSchema).min(1),
});

// PUT /api/estimate/:id — обновить смету (заголовок, заказчик, состав позиций)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  const { userId } = gate;

  const { id } = await params;
  const exists = await prisma.estimate.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!exists) return NextResponse.json({ error: "not found" }, { status: 404 });

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте поля сметы" }, { status: 400 });
  }

  await updateEstimate(id, userId, parsed.data);
  return NextResponse.json({ ok: true });
}

// DELETE /api/estimate/:id
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  const { userId } = gate;

  const { id } = await params;
  const owned = await prisma.estimate.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!owned) return NextResponse.json({ error: "not found" }, { status: 404 });
  await deleteEstimate(id);
  return NextResponse.json({ ok: true });
}
