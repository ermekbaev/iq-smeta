import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const createSchema = z.object({
  terms: z.array(z.string()).min(1),
});

// нормализуем слова группы: трим, нижний регистр, без пустых и дублей
function cleanTerms(terms: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of terms) {
    const v = t.trim().toLowerCase();
    if (v && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

// GET /api/settings/synonyms — группы синонимов аккаунта
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const items = await prisma.synonym.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, terms: true },
  });
  return NextResponse.json(items);
}

// POST /api/settings/synonyms — добавить группу (минимум 2 разных слова)
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Проверьте поля" }, { status: 400 });

  const terms = cleanTerms(parsed.data.terms);
  if (terms.length < 2) {
    return NextResponse.json({ error: "Нужно минимум два разных слова" }, { status: 400 });
  }

  const created = await prisma.synonym.create({
    data: { userId: session.user.id, terms },
    select: { id: true, terms: true },
  });
  return NextResponse.json(created);
}

// DELETE /api/settings/synonyms?id=... — удалить группу
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.synonym.deleteMany({ where: { id, userId: session.user.id } });
  return NextResponse.json({ ok: true });
}
