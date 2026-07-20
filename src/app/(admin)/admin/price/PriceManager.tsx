"use client";

import { useEffect, useState, useTransition } from "react";
import UploadButton from "@/components/UploadButton";

interface Item {
  id: string;
  article: string | null;
  name: string;
  unit: string;
  price: number; // РРЦ
  cost: number | null; // ОПТ
  category: string;
}

export default function PriceManager() {
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState("");
  const [categories, setCategories] = useState<{ category: string; count: number }[]>([]);
  const [catFilter, setCatFilter] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<Item | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [direction, setDirection] = useState("");
  const [uploading, setUploading] = useState(false);
  const [, startTransition] = useTransition();
  const [loading, setLoading] = useState(true); // грузим сразу на монтировании

  async function load(query = "", cat = catFilter) {
    setLoading(true);
    const res = await fetch(
      `/api/admin/price?q=${encodeURIComponent(query)}&category=${encodeURIComponent(cat)}`
    );
    setItems(res.ok ? await res.json() : []);
    setLoading(false);
  }

  async function loadCategories() {
    const res = await fetch("/api/categories");
    setCategories(res.ok ? await res.json() : []);
  }

  useEffect(() => {
    // на монтировании состояние синхронно не трогаем (иначе каскадный рендер):
    // индикатор уже включён начальным loading=true, остальное — после await
    void (async () => {
      const [itemsRes, catsRes] = await Promise.all([
        fetch("/api/admin/price?q=&category="),
        fetch("/api/categories"),
      ]);
      setItems(itemsRes.ok ? await itemsRes.json() : []);
      setCategories(catsRes.ok ? await catsRes.json() : []);
      setLoading(false);
    })();
  }, []);

  async function onUpload() {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    if (direction.trim()) fd.append("direction", direction.trim());
    setUploading(true);
    setMsg("Загрузка…");
    const res = await fetch("/api/admin/price/upload", {
      method: "POST",
      body: fd,
    });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) {
      setMsg(`Ошибка: ${data.error ?? "не удалось"}`);
      return;
    }
    setMsg(
      `Готово: ${data.imported} позиций (новых ${data.created}, обновлено ${data.updated}, пропущено ${data.skipped}).` +
        (data.embedFailed
          ? " ⚠️ Позиции сохранены, но поиск по ним появится после переиндексации (сервис ИИ был недоступен)."
          : "")
    );
    setFile(null);
    setDirection("");
    void loadCategories(); // после загрузки могли появиться новые разделы
    startTransition(() => void load(q));
  }

  async function saveEdit() {
    if (!editing) return;
    const res = await fetch(`/api/admin/price/${editing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        article: editing.article || null,
        name: editing.name,
        unit: editing.unit,
        price: Number(editing.price),
        cost: editing.cost === null || editing.cost === undefined ? null : Number(editing.cost),
        category: editing.category || "Прочее",
      }),
    });
    if (res.ok) {
      setEditing(null);
      void load(q);
    } else {
      setMsg("Не удалось сохранить позицию");
    }
  }

  async function remove(id: string) {
    if (!confirm("Удалить позицию?")) return;
    const res = await fetch(`/api/admin/price/${id}`, { method: "DELETE" });
    if (res.ok) void load(q);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-white p-5">
        <h2 className="mb-3 font-medium text-gray-900">Загрузить прайс (Excel/CSV)</h2>
        <div className="flex flex-wrap items-center gap-3">
          <UploadButton
            accept=".xlsx,.xls,.csv"
            label={file ? "Другой файл" : "Выбрать файл"}
            onFile={setFile}
          />
          {file && <span className="text-sm text-gray-600">{file.name}</span>}
          <input
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
            placeholder="Направление (напр. Дренаж)"
            className="min-w-0 rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            onClick={onUpload}
            disabled={!file || uploading}
            className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {uploading ? "Загрузка…" : "Загрузить"}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Колонки: «наименование», «ед.», «цена» (Кол-во/Итого игнорируются). Укажите
          <b> направление</b> — все позиции файла попадут в эту категорию. Повторная
          загрузка обновляет цены по совпадению названия+единицы.
        </p>
        {msg && <p className="mt-2 text-sm text-gray-700">{msg}</p>}
      </section>

      <section className="rounded-xl border bg-white p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium text-gray-900">Позиции</h2>
          <div className="flex flex-wrap items-center gap-2">
            {categories.length > 0 && (
              <select
                value={catFilter}
                onChange={(e) => {
                  setCatFilter(e.target.value);
                  void load(q, e.target.value);
                }}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-gray-900"
              >
                <option value="">Все разделы</option>
                {categories.map((c) => (
                  <option key={c.category} value={c.category}>
                    {c.category} ({c.count})
                  </option>
                ))}
              </select>
            )}
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                void load(e.target.value);
              }}
              placeholder="Поиск…"
              className="rounded border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-gray-900"
            />
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Загрузка…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500">Пока пусто. Загрузите прайс выше.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2 pr-3">Артикул</th>
                  <th className="py-2 pr-3">Наименование</th>
                  <th className="py-2 pr-3">Ед.</th>
                  <th className="py-2 pr-3">Цена (РРЦ)</th>
                  <th className="py-2 pr-3">Раздел</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 text-gray-500">{it.article ?? "—"}</td>
                    <td className="py-2 pr-3 text-gray-900">{it.name}</td>
                    <td className="py-2 pr-3 text-gray-600">{it.unit}</td>
                    <td className="py-2 pr-3 text-gray-900">{it.price.toFixed(2)}</td>
                    <td className="py-2 pr-3 text-gray-600">{it.category}</td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => setEditing(it)}
                        className="text-gray-500 hover:text-gray-900"
                      >
                        ред.
                      </button>
                      <button
                        onClick={() => remove(it.id)}
                        className="ml-3 text-red-400 hover:text-red-600"
                      >
                        удал.
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md space-y-3 rounded-xl bg-white p-5 shadow-lg">
            <h3 className="font-medium text-gray-900">Редактировать позицию</h3>
            <label className="block space-y-1">
              <span className="text-xs text-gray-500">Наименование</span>
              <input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <div className="flex gap-3">
              <label className="block flex-1 space-y-1">
                <span className="text-xs text-gray-500">Ед.</span>
                <input
                  value={editing.unit}
                  onChange={(e) => setEditing({ ...editing, unit: e.target.value })}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block flex-1 space-y-1">
                <span className="text-xs text-gray-500">Цена</span>
                <input
                  type="number"
                  step="0.01"
                  value={editing.price}
                  onChange={(e) =>
                    setEditing({ ...editing, price: Number(e.target.value) })
                  }
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <label className="block space-y-1">
              <span className="text-xs text-gray-500">Раздел / категория</span>
              <input
                value={editing.category}
                onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                placeholder="Прочее"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setEditing(null)}
                className="rounded px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
              >
                Отмена
              </button>
              <button
                onClick={saveEdit}
                className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
