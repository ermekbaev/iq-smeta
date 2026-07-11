import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

const money = (n: number) =>
  n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function EstimatesPage() {
  const session = await auth();
  const estimates = await prisma.estimate.findMany({
    where: { userId: session!.user.id },
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
        <>
          {/* Мобайл: карточки — ничего не режется, всё влезает по вертикали */}
          <div className="space-y-3 sm:hidden">
            {estimates.map((e) => (
              <Link
                key={e.id}
                href={`/admin/estimates/${e.id}`}
                className="block rounded-xl border bg-white p-4 active:bg-gray-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium text-gray-900">{e.title}</span>
                  <span className="shrink-0 font-semibold text-gray-900 whitespace-nowrap">
                    {money(Number(e.total))} ₽
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                  <span>{e.clientName ?? "Без заказчика"}</span>
                  <span>· {e._count.items} поз.</span>
                  <span>· {e.createdAt.toLocaleDateString("ru-RU")}</span>
                </div>
              </Link>
            ))}
          </div>

          {/* Десктоп: полноценная таблица */}
          <div className="hidden overflow-x-auto rounded-xl border bg-white sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="px-4 py-2">Название</th>
                  <th className="px-4 py-2">Заказчик</th>
                  <th className="px-4 py-2 whitespace-nowrap">Позиций</th>
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
                    <td className="px-4 py-2 text-right text-gray-900 whitespace-nowrap">
                      {money(Number(e.total))} ₽
                    </td>
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                      {e.createdAt.toLocaleDateString("ru-RU")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
