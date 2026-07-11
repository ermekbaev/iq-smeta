import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import EstimateEditor, { EditLine } from "./EstimateEditor";

export default async function EstimateEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const estimate = await prisma.estimate.findFirst({
    where: { id, userId: session!.user.id },
    include: { items: { orderBy: { category: "asc" } } },
  });
  if (!estimate) notFound();

  const lines: EditLine[] = estimate.items.map((it) => ({
    priceItemId: it.priceItemId,
    name: it.name,
    qty: Number(it.qty),
    unit: it.unit,
    price: Number(it.price),
    category: it.category,
  }));

  return (
    <div className="space-y-4">
      <Link
        href={`/admin/estimates/${id}`}
        className="text-sm text-gray-500 hover:text-gray-900"
      >
        ← К смете
      </Link>
      <h1 className="text-2xl font-semibold text-gray-900">Редактирование сметы</h1>
      <EstimateEditor
        id={id}
        initialTitle={estimate.title}
        initialObject={estimate.objectName ?? ""}
        initialClient={estimate.clientName ?? ""}
        initialLines={lines}
      />
    </div>
  );
}
