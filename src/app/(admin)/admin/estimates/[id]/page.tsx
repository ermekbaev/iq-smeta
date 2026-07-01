import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { groupByCategory } from "@/lib/estimate/service";
import DeleteEstimateButton from "./DeleteEstimateButton";

const money = (n: number) =>
  n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function EstimateDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const estimate = await prisma.estimate.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!estimate) notFound();

  const groups = groupByCategory(estimate.items);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/admin/estimates"
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            ← Все сметы
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">
            {estimate.title}
          </h1>
          <p className="text-sm text-gray-500">
            № {estimate.id.slice(-6).toUpperCase()} ·{" "}
            {estimate.createdAt.toLocaleDateString("ru-RU")}
            {estimate.clientName ? ` · ${estimate.clientName}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/estimates/${estimate.id}/edit`}
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Редактировать
          </Link>
          <DeleteEstimateButton id={estimate.id} />
          <a
            href={`/api/estimate/${estimate.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Скачать PDF
          </a>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-gray-500">
              <th className="px-4 py-2">Наименование</th>
              <th className="px-4 py-2">Ед.</th>
              <th className="px-4 py-2 text-right">Кол-во</th>
              <th className="px-4 py-2 text-right">Цена</th>
              <th className="px-4 py-2 text-right">Сумма</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.category}>
                <tr className="bg-indigo-50">
                  <td colSpan={5} className="px-4 py-1.5 font-semibold text-gray-800">
                    {g.label}
                  </td>
                </tr>
                {g.lines.map((l, i) => (
                  <tr key={`${g.category}-${i}`} className="border-b last:border-0">
                    <td className="px-4 py-2 text-gray-900">{l.name}</td>
                    <td className="px-4 py-2 text-gray-600">{l.unit}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{money(l.qty)}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{money(l.price)}</td>
                    <td className="px-4 py-2 text-right text-gray-900">{money(l.sum)}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50">
                  <td colSpan={4} className="px-4 py-1.5 text-right text-gray-600">
                    Итого по разделу
                  </td>
                  <td className="px-4 py-1.5 text-right font-medium text-gray-900">
                    {money(g.subtotal)}
                  </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2">
              <td colSpan={4} className="px-4 py-3 text-right text-lg font-semibold text-gray-900">
                ИТОГО
              </td>
              <td className="px-4 py-3 text-right text-lg font-semibold text-gray-900">
                {money(Number(estimate.total))} ₽
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
