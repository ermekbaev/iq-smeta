import Link from "next/link";
import { prisma } from "@/lib/prisma";

const money = (n: number) =>
  n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function EstimatesPage() {
  const estimates = await prisma.estimate.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      title: true,
      clientName: true,
      total: true,
      createdAt: true,
      _count: { select: { items: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Сметы</h1>
        <Link
          href="/record"
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          + Новая смета
        </Link>
      </div>

      {estimates.length === 0 ? (
        <p className="text-sm text-gray-500">
          Пока нет смет. Создайте первую через запись голоса.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="px-4 py-2">Название</th>
                <th className="px-4 py-2">Заказчик</th>
                <th className="px-4 py-2">Позиций</th>
                <th className="px-4 py-2 text-right">Итого</th>
                <th className="px-4 py-2">Дата</th>
              </tr>
            </thead>
            <tbody>
              {estimates.map((e) => (
                <tr key={e.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <Link href={`/admin/estimates/${e.id}`} className="text-gray-900 hover:underline">
                      {e.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-gray-600">{e.clientName ?? "—"}</td>
                  <td className="px-4 py-2 text-gray-600">{e._count.items}</td>
                  <td className="px-4 py-2 text-right text-gray-900">
                    {money(Number(e.total))} ₽
                  </td>
                  <td className="px-4 py-2 text-gray-500">
                    {e.createdAt.toLocaleDateString("ru-RU")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
