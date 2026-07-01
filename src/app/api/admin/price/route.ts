import { NextResponse } from "next/server";
import { z } from "zod";
import { Category } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ai } from "@/lib/ai";
import { setEmbedding } from "@/lib/match";

export const runtime = "nodejs";

const itemSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  price: z.number().nonnegative(),
  category: z.nativeEnum(Category),
});

// GET /api/admin/price — список позиций (поиск через ?q=)
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const q = new URL(req.url).searchParams.get("q")?.trim();
  const items = await prisma.priceItem.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : undefined,
    orderBy: { name: "asc" },
    take: 500,
    select: { id: true, name: true, unit: true, price: true, category: true },
  });
  return NextResponse.json(
    items.map((i) => ({ ...i, price: Number(i.price) }))
  );
}

// POST /api/admin/price — создать позицию вручную
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = itemSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте поля" }, { status: 400 });
  }

  const item = await prisma.priceItem.create({
    data: parsed.data,
    select: { id: true },
  });
  await setEmbedding(item.id, await ai.embeddings.embed(parsed.data.name));
  return NextResponse.json({ ok: true, id: item.id });
}
