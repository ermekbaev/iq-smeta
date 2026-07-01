import { NextResponse } from "next/server";
import { z } from "zod";
import { Category } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { deleteEstimate, updateEstimate } from "@/lib/estimate/service";

export const runtime = "nodejs";

const lineSchema = z.object({
  priceItemId: z.string().nullable().optional(),
  name: z.string().min(1),
  qty: z.number().positive(),
  unit: z.string().min(1),
  price: z.number().nonnegative(),
  category: z.nativeEnum(Category),
});

const updateSchema = z.object({
  title: z.string().min(1),
  clientName: z.string().nullable().optional(),
  lines: z.array(lineSchema).min(1),
});

// PUT /api/estimate/:id — обновить смету (заголовок, заказчик, состав позиций)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const exists = await prisma.estimate.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "not found" }, { status: 404 });

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте поля сметы" }, { status: 400 });
  }

  await updateEstimate(id, parsed.data);
  return NextResponse.json({ ok: true });
}

// DELETE /api/estimate/:id
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  await deleteEstimate(id);
  return NextResponse.json({ ok: true });
}
