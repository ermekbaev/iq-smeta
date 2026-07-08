import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { groupByCategory } from "@/lib/estimate/service";
import { estimateHtml } from "@/lib/pdf/template";
import { renderPdf } from "@/lib/pdf/render";
import { getCompanyBrand } from "@/lib/brand/company";

export const runtime = "nodejs";

// GET /api/estimate/:id/pdf — фирменная смета в PDF.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const estimate = await prisma.estimate.findUnique({
    where: { id },
    include: { items: { include: { priceItem: { select: { article: true } } } } },
  });
  if (!estimate) return NextResponse.json({ error: "not found" }, { status: 404 });

  // артикул берём из связанной позиции прайса (у ручных позиций его нет)
  const items = estimate.items.map((it) => ({ ...it, article: it.priceItem?.article ?? null }));

  const company = await getCompanyBrand();
  const date = estimate.createdAt.toLocaleDateString("ru-RU");

  const html = estimateHtml({
    number: estimate.id.slice(-6).toUpperCase(),
    date,
    title: estimate.title,
    clientName: estimate.clientName,
    groups: groupByCategory(items),
    total: Number(estimate.total),
    logo: estimate.logo,
    company,
  });

  // Имя файла: IQsmeta_<объект/заказчик>_<дата>.pdf
  // Объект — заказчик, если задан, иначе название сметы.
  const object = (estimate.clientName || estimate.title || "смета")
    .replace(/[\/\\:*?"<>|\r\n]+/g, " ") // убрать недопустимые в имени файла
    .replace(/\s+/g, " ")
    .trim();
  const base = `IQsmeta_${object}_${date}.pdf`;
  // ASCII-фолбэк (старые клиенты) + UTF-8 по RFC 5987 (кириллица корректно).
  const ascii = base.replace(/[^\x20-\x7E]+/g, "_").replace(/["\\]/g, "");
  const disposition = `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(base)}`;

  const pdf = await renderPdf(html);
  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": disposition,
    },
  });
}
