// Общая база синонимов — CRUD только для сопровождающего (вариант A).
// Группы с isGlobal=true применяются при подборе у ВСЕХ аккаунтов.
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireGlobalSynonymAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const createSchema = z.object({ terms: z.array(z.string()).min(1) });

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

// GET — все группы общей базы
export async function GET() {
  const gate = await requireGlobalSynonymAdmin();
  if (gate instanceof NextResponse) return gate;
  const items = await prisma.synonym.findMany({
    where: { isGlobal: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, terms: true },
  });
  return NextResponse.json(items);
}

// POST — добавить группу в общую базу
export async function POST(req: Request) {
  const gate = await requireGlobalSynonymAdmin();
  if (gate instanceof NextResponse) return gate;
  const { userId } = gate;

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Проверьте поля" }, { status: 400 });

  const terms = cleanTerms(parsed.data.terms);
  if (terms.length < 2) {
    return NextResponse.json({ error: "Нужно минимум два разных слова" }, { status: 400 });
  }

  const created = await prisma.synonym.create({
    data: { userId, terms, isGlobal: true },
    select: { id: true, terms: true },
  });
  return NextResponse.json(created);
}

// DELETE ?id=... — удалить группу из общей базы
export async function DELETE(req: Request) {
  const gate = await requireGlobalSynonymAdmin();
  if (gate instanceof NextResponse) return gate;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.synonym.deleteMany({ where: { id, isGlobal: true } });
  return NextResponse.json({ ok: true });
}
