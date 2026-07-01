import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { groupByCategory } from "@/lib/estimate/service";
import { estimateHtml } from "@/lib/pdf/template";
import { renderPdf } from "@/lib/pdf/render";

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
    include: { items: true },
  });
  if (!estimate) return NextResponse.json({ error: "not found" }, { status: 404 });

  const html = estimateHtml({
    number: estimate.id.slice(-6).toUpperCase(),
    date: estimate.createdAt.toLocaleDateString("ru-RU"),
    title: estimate.title,
    clientName: estimate.clientName,
    groups: groupByCategory(estimate.items),
    total: Number(estimate.total),
  });

  const pdf = await renderPdf(html);
  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="smeta-${estimate.id.slice(-6)}.pdf"`,
    },
  });
}
