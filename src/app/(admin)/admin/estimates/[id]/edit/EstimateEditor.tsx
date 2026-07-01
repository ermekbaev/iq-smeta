"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const CATEGORIES = [
  { value: "MATERIALS", label: "Материалы" },
  { value: "WORKS", label: "Работы" },
  { value: "EQUIPMENT", label: "Оборудование" },
  { value: "DELIVERY", label: "Доставка" },
  { value: "OVERHEAD", label: "Издержки" },
];

export interface EditLine {
  priceItemId: string | null;
  name: string;
  qty: number;
  unit: string;
  price: number;
  category: string;
}

export default function EstimateEditor({
  id,
  initialTitle,
  initialClient,
  initialLines,
}: {
  id: string;
  initialTitle: string;
  initialClient: string;
  initialLines: EditLine[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [clientName, setClientName] = useState(initialClient);
  const [lines, setLines] = useState<EditLine[]>(initialLines);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const money = (n: number) =>
    n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const total = lines.reduce((a, l) => a + l.qty * l.price, 0);

  const update = (i: number, patch: Partial<EditLine>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, idx) => idx !== i));
  const addLine = () =>
    setLines((ls) => [
      ...ls,
      { priceItemId: null, name: "", qty: 1, unit: "шт", price: 0, category: "MATERIALS" },
    ]);

  async function save() {
    if (lines.some((l) => !l.name.trim())) {
      setError("У всех позиций должно быть наименование.");
      return;
    }
    setError(null);
    setBusy(true);
    const res = await fetch(`/api/estimate/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title || "Смета",
        clientName: clientName || null,
        lines: lines.map((l) => ({
          priceItemId: l.priceItemId,
          name: l.name,
          qty: l.qty,
          unit: l.unit,
          price: l.price,
          category: l.category,
        })),
      }),
    });
    setBusy(false);
    if (res.ok) {
      router.push(`/admin/estimates/${id}`);
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Не удалось сохранить.");
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
      )}

      <section className="grid gap-3 rounded-xl border bg-white p-5 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs text-gray-500">Название сметы</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-gray-500">Заказчик</span>
          <input
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
      </section>

      <section className="space-y-2 rounded-xl border bg-white p-5">
        {lines.map((l, i) => (
          <div
            key={i}
            className="grid items-end gap-2 sm:grid-cols-[1fr_130px_70px_90px_100px_auto]"
          >
            <label className="space-y-1">
              {i === 0 && <span className="text-[11px] text-gray-400">Наименование</span>}
              <input
                value={l.name}
                onChange={(e) => update(i, { name: e.target.value })}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="space-y-1">
              {i === 0 && <span className="text-[11px] text-gray-400">Категория</span>}
              <select
                value={l.category}
                onChange={(e) => update(i, { category: e.target.value })}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              {i === 0 && <span className="text-[11px] text-gray-400">Кол-во</span>}
              <input
                type="number"
                step="0.001"
                value={l.qty}
                onChange={(e) => update(i, { qty: Number(e.target.value) })}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="space-y-1">
              {i === 0 && <span className="text-[11px] text-gray-400">Ед.</span>}
              <input
                value={l.unit}
                onChange={(e) => update(i, { unit: e.target.value })}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="space-y-1">
              {i === 0 && <span className="text-[11px] text-gray-400">Цена</span>}
              <input
                type="number"
                step="0.01"
                value={l.price}
                onChange={(e) => update(i, { price: Number(e.target.value) })}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
            <button
              onClick={() => removeLine(i)}
              className="pb-1.5 text-red-400 hover:text-red-600"
              title="Удалить позицию"
            >
              ✕
            </button>
          </div>
        ))}

        <button
          onClick={addLine}
          className="mt-1 text-sm text-gray-600 hover:text-gray-900"
        >
          + Добавить позицию
        </button>

        <div className="flex items-center justify-between border-t pt-3">
          <span className="text-lg font-semibold text-gray-900">
            Итого: {money(total)} ₽
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => router.push(`/admin/estimates/${id}`)}
              className="rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
            >
              Отмена
            </button>
            <button
              onClick={save}
              disabled={busy || lines.length === 0}
              className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {busy ? "Сохраняю…" : "Сохранить"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
