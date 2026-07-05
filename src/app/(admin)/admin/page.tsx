import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function AdminDashboard() {
  const [priceCount, estimateCount] = await Promise.all([
    prisma.priceItem.count(),
    prisma.estimate.count(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Панель</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/price"
          className="rounded-xl border bg-white p-5 shadow-sm hover:border-gray-400"
        >
          <div className="text-3xl font-semibold text-gray-900">{priceCount}</div>
          <div className="mt-1 text-sm text-gray-600">позиций в прайсе →</div>
        </Link>
        <Link
          href="/admin/estimates"
          className="rounded-xl border bg-white p-5 shadow-sm hover:border-gray-400"
        >
          <div className="text-3xl font-semibold text-gray-900">{estimateCount}</div>
          <div className="mt-1 text-sm text-gray-600">смет создано →</div>
        </Link>
      </div>
      <Link
        href="/admin/settings"
        className="block rounded-xl border bg-white p-5 shadow-sm hover:border-gray-400"
      >
        <div className="font-medium text-gray-900">Настройки компании →</div>
        <div className="mt-1 text-sm text-gray-600">
          Реквизиты, логотип и печать для КП
        </div>
      </Link>
    </div>
  );
}
