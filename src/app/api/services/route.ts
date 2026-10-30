// Услуги аккаунта — разделы прайса, сведённые в понятный список (Автополив, Освещение…),
// для выбора услуги на экране записи. Общие разделы (доставка, расходники) идут в каждую услугу.
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { SERVICES, mapCategories } from "@/lib/services";

export const runtime = "nodejs";

export async function GET() {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  const { userId } = gate;

  const items = await prisma.priceItem.findMany({ where: { userId }, select: { category: true, name: true } });
  const map = mapCategories(items);
  const count = new Map<string, number>();
  for (const it of items) count.set(it.category, (count.get(it.category) ?? 0) + 1);

  const general = [...map].filter(([, s]) => !s).map(([c]) => c);
  const services = SERVICES.map((s) => {
    const categories = [...map].filter(([, x]) => x?.id === s.id).map(([c]) => c);
    return {
      id: s.id,
      label: s.label,
      subject: s.subject,
      spoken: s.spoken,
      count: categories.reduce((a, c) => a + (count.get(c) ?? 0), 0),
      categories: [...categories, ...general],
    };
  }).filter((s) => s.count > 0);

  return NextResponse.json(services);
}
