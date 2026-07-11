import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { ai } from "@/lib/ai";
import { setEmbedding } from "@/lib/match";

export const runtime = "nodejs";

const itemSchema = z.object({
  article: z.string().nullable().optional(),
  name: z.string().min(1),
  unit: z.string().min(1),
  price: z.number().nonnegative(),
  cost: z.number().nonnegative().nullable().optional(),
  category: z.string().min(1).default("Прочее"),
});

// GET /api/admin/price — список позиций (поиск через ?q=)
export async function GET(req: Request) {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  const { userId } = gate;

  const q = new URL(req.url).searchParams.get("q")?.trim();
  const items = await prisma.priceItem.findMany({
    where: {
      userId,
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    },
    orderBy: { name: "asc" },
    take: 500,
    select: {
      id: true,
      article: true,
      name: true,
      unit: true,
      price: true,
      cost: true,
      category: true,
    },
  });
  return NextResponse.json(
    items.map((i) => ({ ...i, price: Number(i.price), cost: i.cost === null ? null : Number(i.cost) }))
  );
}

// POST /api/admin/price — создать позицию вручную
export async function POST(req: Request) {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  const { userId } = gate;

  const parsed = itemSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте поля" }, { status: 400 });
  }

  const { article, name } = parsed.data;
  const item = await prisma.priceItem.create({
    data: { ...parsed.data, userId },
    select: { id: true },
  });
  const text = [article, name].filter(Boolean).join(" ");
  await setEmbedding(item.id, await ai.embeddings.embed(text));
  return NextResponse.json({ ok: true, id: item.id });
}
