import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const IMG_MAX = 4_000_000; // data URL картинки

const schema = z.object({
  name: z.string().max(300).optional(),
  inn: z.string().max(50).nullable().optional(),
  ogrn: z.string().max(50).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  phone: z.string().max(100).nullable().optional(),
  email: z.string().max(200).nullable().optional(),
  website: z.string().max(200).nullable().optional(),
  bankName: z.string().max(300).nullable().optional(),
  bankAccount: z.string().max(64).nullable().optional(),
  bankCorAccount: z.string().max(64).nullable().optional(),
  bankBik: z.string().max(32).nullable().optional(),
  signer: z.string().max(200).nullable().optional(),
  logo: z.string().max(IMG_MAX).nullable().optional(),
  stamp: z.string().max(IMG_MAX).nullable().optional(),
  signature: z.string().max(IMG_MAX).nullable().optional(),
});

// GET /api/settings/company — реквизиты текущего аккаунта (или пусто)
export async function GET() {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  const { userId } = gate;
  const s = await prisma.companySettings.findUnique({ where: { userId } });
  return NextResponse.json(s ?? {});
}

// PUT /api/settings/company — сохранить реквизиты/картинки текущего аккаунта
export async function PUT(req: Request) {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  const { userId } = gate;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте поля" }, { status: 400 });
  }
  const data = parsed.data;

  const saved = await prisma.companySettings.upsert({
    where: { userId },
    create: { userId, ...data, name: data.name ?? "" },
    update: data,
  });
  return NextResponse.json(saved);
}
