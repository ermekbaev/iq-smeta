import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const schema = z.object({
  groups: z.array(z.array(z.string())).min(1).max(2000),
});

function clean(terms: string[]): string[] {
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

// ключ группы (порядок слов не важен) — для дедупликации
const key = (terms: string[]) => [...terms].sort().join("|");

// POST /api/settings/synonyms/import — массовое добавление групп
export async function POST(req: Request) {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  const { userId } = gate;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Проверьте формат" }, { status: 400 });

  // уже существующие группы — чтобы не плодить дубли при повторном импорте
  const existing = await prisma.synonym.findMany({
    where: { userId },
    select: { terms: true },
  });
  const seen = new Set(existing.map((g) => key(clean(g.terms))));

  const toCreate: { userId: string; terms: string[] }[] = [];
  let skipped = 0;
  for (const raw of parsed.data.groups) {
    const terms = clean(raw);
    if (terms.length < 2) {
      skipped++;
      continue;
    }
    const k = key(terms);
    if (seen.has(k)) {
      skipped++;
      continue;
    }
    seen.add(k);
    toCreate.push({ userId, terms });
  }

  if (toCreate.length) {
    await prisma.synonym.createMany({ data: toCreate });
  }
  return NextResponse.json({ created: toCreate.length, skipped });
}
