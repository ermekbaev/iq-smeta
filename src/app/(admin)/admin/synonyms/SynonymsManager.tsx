"use client";

import { useCallback, useEffect, useState } from "react";
import UploadButton from "@/components/UploadButton";

interface Group {
  id: string;
  terms: string[];
}

interface Props {
  isMaintainer: boolean; // ведёт общую базу (вариант A)
  aiAvailable: boolean; // провайдер умеет ИИ-подсказки
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

export default function SynonymsManager({ isMaintainer, aiAvailable }: Props) {
  return (
    <div className="space-y-6">
      <GroupEditor
        endpoint="/api/settings/synonyms"
        importEndpoint="/api/settings/synonyms/import"
        aiAvailable={aiAvailable}
        title="Мои синонимы"
        hint="Слова, означающие одно и то же. Подбор работает в обе стороны: скажете «форсунка» — найдёт «сопло», и наоборот."
      />
      {isMaintainer && (
        <GroupEditor
          endpoint="/api/settings/synonyms/global"
          aiAvailable={aiAvailable}
          title="Общая база (для всех аккаунтов)"
          hint="Эти группы применяются при подборе у всех аккаунтов, но в их личных списках не видны. Ведёте только вы."
          accent
        />
      )}
    </div>
  );
}

function GroupEditor({
  endpoint,
  importEndpoint,
  aiAvailable,
  title,
  hint,
  accent,
}: {
  endpoint: string;
  importEndpoint?: string;
  aiAvailable: boolean;
  title: string;
  hint: string;
  accent?: boolean;
}) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  // предупреждение ИИ: слова похоже не синонимы — просим подтвердить
  const [warn, setWarn] = useState<{ terms: string[]; note: string } | null>(null);
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
  }, [load]);

  function termsFromInput(): string[] {
    return input
      .split(/[,;]+/)
      .map((t) => t.trim())
      .filter(Boolean);
  }

  // фактическое создание группы
  async function create(terms: string[]) {
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
      setSuggestions([]);
      setWarn(null);
    } else {
      const d = await res.json().catch(() => ({}));
      setMsg(d.error ?? "Не удалось добавить");
    }
  }

  // добавление с проверкой ИИ (если доступен): сомнительное — под подтверждение
  async function add() {
    const terms = termsFromInput();
    if (terms.length < 2) {
      setMsg("Введите минимум два слова через запятую: «сопло, форсунка»");
      return;
    }
    setWarn(null);
    if (aiAvailable) {
      setBusy(true);
      try {
        const r = await fetch("/api/settings/synonyms/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "validate", terms }),
        });
        if (r.ok) {
          const v = await r.json();
          if (v.ok === false) {
            setBusy(false);
            setWarn({ terms, note: v.note || "ИИ считает эти слова разными по смыслу." });
            return;
          }
        }
      } catch {
        // ИИ недоступен — не блокируем
      }
      setBusy(false);
    }
    await create(terms);
  }

  // ИИ подсказывает синонимы к первому слову ввода
  async function suggest() {
    const first = termsFromInput()[0] ?? input.trim();
    if (!first) {
      setMsg("Введите слово, к которому подобрать синонимы");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/settings/synonyms/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "suggest", term: first }),
      });
      const d = r.ok ? await r.json() : { suggestions: [] };
      setSuggestions(d.suggestions ?? []);
      if (!d.suggestions?.length) setMsg("ИИ не нашёл синонимов к этому слову");
    } catch {
      setMsg("ИИ недоступен");
    } finally {
      setBusy(false);
    }
  }

  function addSuggestion(word: string) {
    const cur = termsFromInput();
    if (cur.some((t) => t.toLowerCase() === word.toLowerCase())) return;
    setInput((prev) => (prev.trim() ? `${prev.trim()}, ${word}` : word));
    setSuggestions((prev) => prev.filter((s) => s !== word));
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
        {aiAvailable && (
          <button
            type="button"
            onClick={suggest}
            disabled={busy}
            title="ИИ предложит синонимы к первому слову"
            className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Подсказать ИИ
          </button>
        )}
        <button
          onClick={add}
          disabled={busy}
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          Добавить
        </button>
      </div>

      {/* ИИ-подсказки — клик добавляет слово во ввод */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">ИИ предлагает:</span>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addSuggestion(s)}
              className="rounded-full border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:border-gray-900 hover:text-gray-900"
            >
              + {s}
            </button>
          ))}
        </div>
      )}

      {/* Предупреждение ИИ о сомнительной группе — финальное «да» за человеком */}
      {warn && (
        <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm text-amber-800">
            ИИ сомневается: «{warn.terms.join(" = ")}». {warn.note}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => create(warn.terms)}
              disabled={busy}
              className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
            >
              Всё равно добавить
            </button>
            <button
              onClick={() => setWarn(null)}
              className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

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
