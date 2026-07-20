"use client";

import { useCallback, useEffect, useState } from "react";
import UploadButton from "@/components/UploadButton";

interface Group {
  id: string;
  terms: string[];
}

interface Props {
  isMaintainer: boolean; // ведёт общую базу (вариант A)
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

export default function SynonymsManager({ isMaintainer }: Props) {
  // бампается при переносе группы из обзора — чтобы список общей базы перечитался
  const [globalVersion, setGlobalVersion] = useState(0);

  return (
    <div className="space-y-6">
      <GroupEditor
        endpoint="/api/settings/synonyms"
        importEndpoint="/api/settings/synonyms/import"
        title="Мои синонимы"
        hint="Слова, означающие одно и то же. Подбор работает в обе стороны: скажете «форсунка» — найдёт «сопло», и наоборот. Видны и применяются только в вашем аккаунте."
      />
      {isMaintainer && (
        <>
          <GroupEditor
            endpoint="/api/settings/synonyms/global"
            title="Общая база (для всех аккаунтов)"
            hint="Эти группы применяются при подборе у всех аккаунтов, но в их личных списках не видны. Ведёте и модерируете только вы."
            refreshKey={globalVersion}
            accent
          />
          <ReviewPanel onPromoted={() => setGlobalVersion((v) => v + 1)} />
        </>
      )}
    </div>
  );
}

interface ReviewItem {
  terms: string[];
  accounts: string[];
  inGlobal: boolean;
}

/** Что добавляют в свои словари другие аккаунты — источник пополнения общей базы. */
function ReviewPanel({ onPromoted }: { onPromoted: () => void }) {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [onlyNew, setOnlyNew] = useState(true);

  const load = useCallback(() => {
    fetch("/api/settings/synonyms/review")
      .then((r) => (r.ok ? r.json() : []))
      .then(setItems)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function promote(terms: string[]) {
    const key = terms.join("|");
    setBusy(key);
    setMsg(null);
    const res = await fetch("/api/settings/synonyms/global", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ terms }),
    });
    setBusy(null);
    if (res.ok) {
      setMsg(`Добавлено в общую базу: ${terms.join(" = ")}`);
      onPromoted();
      load();
    } else {
      const d = await res.json().catch(() => ({}));
      setMsg(d.error ?? "Не удалось добавить");
    }
  }

  const shown = onlyNew ? items.filter((i) => !i.inGlobal) : items;
  const newCount = items.filter((i) => !i.inGlobal).length;

  return (
    <section className="space-y-4 rounded-xl border bg-white p-5">
      <div>
        <h2 className="font-medium text-gray-900">Что добавляют аккаунты</h2>
        <p className="mt-1 text-sm text-gray-500">
          Личные словари всех аккаунтов — чтобы удачные пары переносить в общую базу.
          Одинаковые группы схлопнуты, сверху — те, которых в общей базе ещё нет.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={onlyNew}
          onChange={(e) => setOnlyNew(e.target.checked)}
          className="rounded border-gray-300"
        />
        Показывать только те, которых нет в общей базе ({newCount})
      </label>

      {msg && <p className="text-sm text-gray-700">{msg}</p>}

      {shown.length === 0 ? (
        <p className="text-sm text-gray-400">
          {items.length === 0
            ? "Пока никто ничего не добавлял."
            : "Всё, что добавляют аккаунты, уже есть в общей базе."}
        </p>
      ) : (
        <ul className="space-y-2">
          {shown.map((it) => {
            const key = it.terms.join("|");
            return (
              <li
                key={key}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-gray-900">{it.terms.join(" = ")}</span>
                    {it.inGlobal ? (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                        уже в общей базе
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                        нет в общей базе
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {it.accounts.length > 1
                      ? `${it.accounts.length} аккаунта: ${it.accounts.join(", ")}`
                      : it.accounts.join(", ")}
                  </p>
                </div>
                {!it.inGlobal && (
                  <button
                    onClick={() => promote(it.terms)}
                    disabled={busy === key}
                    className="shrink-0 rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
                  >
                    {busy === key ? "…" : "В общую базу"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function GroupEditor({
  endpoint,
  importEndpoint,
  title,
  hint,
  accent,
  refreshKey = 0,
}: {
  endpoint: string;
  importEndpoint?: string;
  title: string;
  hint: string;
  accent?: boolean;
  refreshKey?: number; // изменение → перечитать список
}) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");

  const load = useCallback(() => {
    fetch(endpoint)
      .then((r) => (r.ok ? r.json() : []))
      .then(setGroups)
      .catch(() => {});
  }, [endpoint]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

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
    const res = await fetch(endpoint, {
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
    if (!importEndpoint) return;
    const parsed = parseGroups(importText);
    if (parsed.length === 0) {
      setMsg("Нет корректных строк. Формат: одна группа в строке, слова через запятую.");
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await fetch(importEndpoint, {
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
    const res = await fetch(`${endpoint}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) setGroups((prev) => prev.filter((g) => g.id !== id));
  }

  return (
    <section
      className={`space-y-4 rounded-xl border bg-white p-5 ${accent ? "border-amber-300" : ""}`}
    >
      <div>
        <h2 className="font-medium text-gray-900">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{hint}</p>
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

      {/* Импорт списком (только личные) */}
      {importEndpoint && (
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
      )}

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
