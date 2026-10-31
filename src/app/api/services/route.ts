// Услуги аккаунта — разделы прайса, сведённые в понятный список (Автополив, Освещение…),
// для выбора услуги на экране записи. Какие позиции входят в услугу — scopeIds (подбор).
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { SERVICES, serviceCounts } from "@/lib/services";

export const runtime = "nodejs";

export async function GET() {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  const { userId } = gate;

  const items = await prisma.priceItem.findMany({ where: { userId }, select: { category: true, name: true } });
  const counts = serviceCounts(items);
  const services = SERVICES.map((s) => ({
    id: s.id,
    label: s.label,
    subject: s.subject,
    spoken: s.spoken,
    count: counts.get(s.id) ?? 0,
  })).filter((s) => s.count > 0);

  return NextResponse.json(services);
}
