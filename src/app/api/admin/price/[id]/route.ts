import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ai } from "@/lib/ai";
import { setEmbedding } from "@/lib/match";

export const runtime = "nodejs";

const updateSchema = z.object({
  article: z.string().nullable().optional(),
  name: z.string().min(1),
  unit: z.string().min(1),
  price: z.number().nonnegative(),
  cost: z.number().nonnegative().nullable().optional(),
  category: z.string().min(1),
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
    select: { name: true, article: true },
  });
  if (!before) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.priceItem.update({ where: { id }, data: parsed.data });

  // название/артикул изменились → пересчитать эмбеддинг
  if (before.name !== parsed.data.name || (before.article ?? null) !== (parsed.data.article ?? null)) {
    const text = [parsed.data.article, parsed.data.name].filter(Boolean).join(" ");
    await setEmbedding(id, await ai.embeddings.embed(text));
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
