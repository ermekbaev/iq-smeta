"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { WavRecorder } from "@/lib/audio/wav-recorder";
import BottomNav from "@/components/BottomNav";

interface Candidate {
  id: string;
  name: string;
  unit: string;
  price: number;
  category: string;
  score: number;
}

interface Line {
  spokenText: string;
  name: string;
  qty: number;
  unit: string;
  price: number;
  priceItemId: string | null;
  category: string;
  candidates: Candidate[];
  needsConfirm: boolean;
}

type Stage = "record" | "draft";

export default function RecordPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("record");
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [title, setTitle] = useState("Смета");
  const [clientName, setClientName] = useState("");

  const recorderRef = useRef<WavRecorder | null>(null);

  const money = (n: number) =>
    n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const total = lines.reduce((a, l) => a + l.qty * l.price, 0);

  async function startRec() {
    setError(null);
    try {
      const rec = new WavRecorder();
      await rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch {
      setError("Нет доступа к микрофону. Разрешите запись в браузере.");
    }
  }

  async function stopRec() {
    setRecording(false);
    setBusy("Распознаю речь…");
    const blob = (await recorderRef.current?.stop()) ?? null;
    if (!blob) {
      setBusy(null);
      return setError("Запись не получилась, попробуйте ещё раз.");
    }
    await transcribe(blob);
  }

  async function transcribe(blob: Blob) {
    const fd = new FormData();
    fd.append("audio", blob, "rec.wav");
    try {
      const res = await fetch("/api/asr", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setBusy(null);
        return setError(data.error ?? "Не удалось распознать речь.");
      }
      setText(data.text);
      // сразу собираем смету из распознанного (голос → черновик без лишнего шага)
      await buildDraft(data.text);
    } catch {
      setBusy(null);
      setError("Сеть недоступна. Расшифровка требует подключения.");
    }
  }

  async function buildDraft(sourceText: string = text) {
    if (!sourceText.trim()) return;
    setError(null);
    setBusy("Извлекаю позиции…");
    try {
      const ex = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sourceText }),
      });
      const exData = await ex.json();
      if (!ex.ok) {
        setBusy(null);
        return setError(exData.error ?? "Не удалось выделить позиции.");
      }

      setBusy("Подбираю по прайсу…");
      const mt = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: exData.items }),
      });
      const mtData = await mt.json();
      setBusy(null);
      if (!mt.ok) return setError(mtData.error ?? "Сбой подбора.");

      // произнесённые цены (выровнены по индексу с результатами подбора)
      const spokenPrices: (number | undefined)[] = exData.items.map(
        (it: { price?: number }) => it.price
      );

      const draft: Line[] = mtData.results.map(
        (r: { input: { name: string; qty: number; unit: string }; match: { best: Candidate | null; candidates: Candidate[]; needsConfirm: boolean } }, i: number) => {
          const spokenPrice = spokenPrices[i];
          const hasSpokenPrice = typeof spokenPrice === "number" && spokenPrice > 0;
          // цена названа голосом → это своя позиция (не привязываем к прайсу),
          // но кандидаты оставляем — при желании можно выбрать каталожную вручную
          const b = hasSpokenPrice ? null : r.match.needsConfirm ? null : r.match.best;
          return {
            spokenText: r.input.name,
            name: b?.name ?? r.input.name,
            qty: r.input.qty,
            unit: b?.unit ?? r.input.unit,
            price: hasSpokenPrice ? (spokenPrice as number) : b?.price ?? 0,
            priceItemId: b?.id ?? null,
            category: b?.category ?? "Прочее",
            candidates: r.match.candidates,
            needsConfirm: hasSpokenPrice ? false : r.match.needsConfirm,
          };
        }
      );
      setLines(draft);
      setStage("draft");
    } catch {
      setBusy(null);
      setError("Ошибка обработки. Попробуйте ещё раз.");
    }
  }

  function update(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function pickCandidate(i: number, candidateId: string) {
    const line = lines[i];
    if (candidateId === "__manual__") {
      update(i, { priceItemId: null, needsConfirm: false });
      return;
    }
    const c = line.candidates.find((x) => x.id === candidateId);
    if (c)
      update(i, {
        priceItemId: c.id,
        name: c.name,
        unit: c.unit,
        price: c.price,
        category: c.category,
        needsConfirm: false,
      });
  }

  function removeLine(i: number) {
    setLines((ls) => ls.filter((_, idx) => idx !== i));
  }

  async function save() {
    setError(null);
    setBusy("Сохраняю смету…");
    try {
      const res = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || "Смета",
          clientName: clientName || null,
          lines: lines.map((l) => ({
            spokenText: l.spokenText,
            priceItemId: l.priceItemId,
            name: l.name,
            qty: l.qty,
            unit: l.unit,
            price: l.price,
            category: l.category,
          })),
        }),
      });
      const data = await res.json();
      setBusy(null);
      if (!res.ok) return setError(data.error ?? "Не удалось сохранить смету.");
      router.push(`/admin/estimates/${data.id}`);
    } catch {
      setBusy(null);
      setError("Сеть недоступна.");
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 pb-24 sm:pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Новая смета</h1>
        <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-900">
          ← В панель
        </Link>
      </div>

      {error && (
        <p className="rounded bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
      )}
      {busy && (
        <p className="rounded bg-blue-50 px-4 py-3 text-sm text-blue-700">{busy}</p>
      )}

      {stage === "record" && (
        <>
          <div className="flex flex-col items-center gap-4 rounded-xl border bg-white p-8">
            {!recording ? (
              <button
                onClick={startRec}
                disabled={!!busy}
                className="rounded-full bg-gray-900 px-8 py-4 text-lg font-medium text-white hover:bg-gray-700 disabled:opacity-50"
              >
                ● Записать
              </button>
            ) : (
              <button
                onClick={stopRec}
                className="animate-pulse rounded-full bg-red-600 px-8 py-4 text-lg font-medium text-white hover:bg-red-700"
              >
                ■ Остановить
              </button>
            )}
            <p className="text-sm text-gray-500">
              {recording
                ? "Идёт запись… надиктуйте материалы и работы."
                : "Нажмите и продиктуйте позиции, либо введите текст ниже."}
            </p>
          </div>

          <section className="space-y-2 rounded-xl border bg-white p-5">
            <h2 className="text-sm font-medium text-gray-500">Текст диктовки</h2>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder="Например: 10 мешков цемента М500, 3 куба песка и доставка самосвалом"
              className="w-full rounded border border-gray-200 px-3 py-2 text-gray-900 outline-none focus:border-gray-900"
            />
            <button
              onClick={() => buildDraft()}
              disabled={!text.trim() || !!busy}
              className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
            >
              Собрать смету →
            </button>
          </section>
        </>
      )}

      {stage === "draft" && (
        <div className="space-y-4">
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
              <span className="text-xs text-gray-500">Заказчик (необязательно)</span>
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          </section>

          <section className="space-y-3 rounded-xl border bg-white p-5">
            <p className="text-xs text-gray-500">
              Жёлтым отмечены позиции с низкой уверенностью подбора — проверьте выбор.
            </p>
            {lines.map((l, i) => (
              <div
                key={i}
                className={`rounded-lg border p-3 ${
                  l.needsConfirm ? "border-yellow-300 bg-yellow-50" : "border-gray-200"
                }`}
              >
                <div className="mb-2 text-xs text-gray-500">
                  Из речи: «{l.spokenText}»
                </div>
                <label className="block space-y-1">
                  <span className="text-[11px] text-gray-400">Позиция</span>
                  <select
                    value={l.priceItemId ?? "__manual__"}
                    onChange={(e) => pickCandidate(i, e.target.value)}
                    title={l.priceItemId ? l.name : "Ввести вручную"}
                    className="w-full truncate rounded border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    {l.candidates
                      .filter((c, idx) => idx === 0 || c.score >= 0.35)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} — {money(c.price)} ₽ ({Math.round(c.score * 100)}%)
                        </option>
                      ))}
                    <option value="__manual__">Ввести вручную…</option>
                  </select>
                </label>
                <div className="mt-2 grid items-end gap-2 grid-cols-[1fr_1fr_1fr_auto]">
                  <label className="space-y-1">
                    <span className="text-[11px] text-gray-400">Кол-во</span>
                    <input
                      type="number"
                      step="0.001"
                      value={l.qty}
                      onChange={(e) => update(i, { qty: Number(e.target.value) })}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] text-gray-400">Ед.</span>
                    <input
                      value={l.unit}
                      onChange={(e) => update(i, { unit: e.target.value })}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] text-gray-400">Цена</span>
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
                {!l.priceItemId && (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-[11px] text-gray-400">
                        Наименование (вручную)
                      </span>
                      <input
                        value={l.name}
                        onChange={(e) => update(i, { name: e.target.value })}
                        className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[11px] text-gray-400">Раздел / категория</span>
                      <input
                        value={l.category}
                        onChange={(e) => update(i, { category: e.target.value })}
                        placeholder="Прочее"
                        className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                      />
                    </label>
                  </div>
                )}
                <div className="mt-2 text-right text-sm text-gray-700">
                  Сумма: <b>{money(l.qty * l.price)} ₽</b>
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-lg font-semibold text-gray-900">
                Итого: {money(total)} ₽
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setStage("record")}
                  className="rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
                >
                  ← Назад
                </button>
                <button
                  onClick={save}
                  disabled={lines.length === 0 || !!busy}
                  className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
                >
                  Сохранить смету
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
      <BottomNav />
    </main>
  );
}
