"use client";

import { useEffect, useState } from "react";

interface Group {
  id: string;
  terms: string[];
}

export default function SynonymsManager() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/synonyms")
      .then((r) => (r.ok ? r.json() : []))
      .then(setGroups)
      .catch(() => {});
  }, []);

  async function add() {
    // слова через запятую: «сопло, форсунка»
    const terms = input
      .split(/[,;]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (terms.length < 2) {
      setMsg("Введите минимум два слова через запятую: «сопло, форсунка»");
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/settings/synonyms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ terms }),
    });
    setBusy(false);
    if (res.ok) {
      const g = await res.json();
      setGroups((prev) => [g, ...prev]);
      setInput("");
    } else {
      const d = await res.json().catch(() => ({}));
      setMsg(d.error ?? "Не удалось добавить");
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/settings/synonyms?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.ok) setGroups((prev) => prev.filter((g) => g.id !== id));
  }

  return (
    <section className="space-y-4 rounded-xl border bg-white p-5">
      <div>
        <h2 className="font-medium text-gray-900">Словарь синонимов</h2>
        <p className="mt-1 text-sm text-gray-500">
          Слова, означающие одно и то же. Подбор работает в обе стороны: скажете
          «форсунка» — найдёт «сопло», и наоборот. Вводите через запятую.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void add();
            }
          }}
          placeholder="сопло, форсунка"
          className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          onClick={add}
          disabled={busy}
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          Добавить
        </button>
      </div>
      {msg && <p className="text-sm text-red-500">{msg}</p>}

      {groups.length === 0 ? (
        <p className="text-sm text-gray-400">Пока пусто. Добавьте первую группу.</p>
      ) : (
        <ul className="space-y-2">
          {groups.map((g) => (
            <li
              key={g.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2"
            >
              <span className="text-sm text-gray-900">{g.terms.join(" = ")}</span>
              <button
                onClick={() => remove(g.id)}
                className="shrink-0 text-sm text-red-400 hover:text-red-600"
              >
                удалить
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
