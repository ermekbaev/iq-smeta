import { NextResponse } from "next/server";
import { z } from "zod";
import { Category } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ai } from "@/lib/ai";
import { setEmbedding } from "@/lib/match";

export const runtime = "nodejs";

const updateSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  price: z.number().nonnegative(),
  category: z.nativeEnum(Category),
});

// PUT /api/admin/price/:id — редактировать позицию
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте поля" }, { status: 400 });
  }

  const before = await prisma.priceItem.findUnique({
    where: { id },
    select: { name: true },
  });
  if (!before) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.priceItem.update({ where: { id }, data: parsed.data });

  // название изменилось → пересчитать эмбеддинг
  if (before.name !== parsed.data.name) {
    await setEmbedding(id, await ai.embeddings.embed(parsed.data.name));
  }
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/price/:id
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.priceItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
