"use client";

import { useEffect, useState } from "react";
import UploadButton from "@/components/UploadButton";

interface Group {
  id: string;
  terms: string[];
}

// строки → группы: одна группа в строке, слова через запятую/точку с запятой/таб
function parseGroups(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) =>
      line
        .split(/[,;\t]+/)
        .map((t) => t.trim())
        .filter(Boolean)
    )
    .filter((g) => g.length >= 2);
}

export default function SynonymsManager() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");

  function load() {
    fetch("/api/settings/synonyms")
      .then((r) => (r.ok ? r.json() : []))
      .then(setGroups)
      .catch(() => {});
  }

  useEffect(() => {
    load();
  }, []);

  async function add() {
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

  async function runImport() {
    const parsed = parseGroups(importText);
    if (parsed.length === 0) {
      setMsg("Нет корректных строк. Формат: одна группа в строке, слова через запятую.");
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/settings/synonyms/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groups: parsed }),
    });
    setBusy(false);
    if (res.ok) {
      const d = await res.json();
      setImportText("");
      setMsg(
        `Импортировано групп: ${d.created}` + (d.skipped ? `, пропущено ${d.skipped}` : "") + "."
      );
      load();
    } else {
      const d = await res.json().catch(() => ({}));
      setMsg(d.error ?? "Не удалось импортировать");
    }
  }

  function onImportFile(f: File) {
    const reader = new FileReader();
    reader.onload = () =>
      setImportText((prev) => (prev ? prev + "\n" : "") + String(reader.result ?? ""));
    reader.readAsText(f);
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

      {/* Импорт списком */}
      <div>
        <button
          type="button"
          onClick={() => setShowImport((v) => !v)}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          {showImport ? "− Скрыть импорт" : "+ Импорт списком"}
        </button>
        {showImport && (
          <div className="mt-2 space-y-2 rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-500">
              Одна группа в строке, слова через запятую. Можно вставить из Excel или
              загрузить файл. Пример:
              <br />
              сопло, форсунка
              <br />
              дождеватель, спринклер
              <br />
              ёмкость, бак, накопитель
            </p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={6}
              placeholder={"сопло, форсунка\nдождеватель, спринклер"}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap items-center gap-3">
              <UploadButton
                accept=".csv,.txt"
                label="Загрузить .csv/.txt"
                onFile={onImportFile}
              />
              <button
                onClick={runImport}
                disabled={busy || !importText.trim()}
                className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
              >
                Импортировать
              </button>
            </div>
          </div>
        )}
      </div>

      {msg && <p className="text-sm text-gray-700">{msg}</p>}

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
