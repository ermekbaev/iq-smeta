"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { WavRecorder } from "@/lib/audio/wav-recorder";
import BottomNav from "@/components/BottomNav";
import UploadButton from "@/components/UploadButton";
import { detectCategoryCommand } from "@/lib/match/category";

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
  const [objectName, setObjectName] = useState("");
  const [subject, setSubject] = useState("");
  const [clientName, setClientName] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  // категории прайса: сужают подбор («бери из дренажа» или выбор вручную)
  const [categories, setCategories] = useState<{ category: string; count: number }[]>([]);
  const [category, setCategory] = useState("");

  const recorderRef = useRef<WavRecorder | null>(null);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => (r.ok ? r.json() : []))
      .then(setCategories)
      .catch(() => {});
  }, []);

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

    // голосовая команда в начале диктовки («бери из дренажа, 10 труб…»)
    // перебивает выбранное вручную: человек сказал явно — значит, так и надо
    const cmd = detectCategoryCommand(
      sourceText,
      categories.map((c) => c.category)
    );
    const activeCategory = cmd.category ?? category;
    if (cmd.category) setCategory(cmd.category);
    const bodyText = cmd.category ? cmd.text : sourceText;
    if (!bodyText.trim()) {
      return setError(
        `Категория «${cmd.category}» выбрана, но позиций не слышно — продиктуйте их.`
      );
    }

    setBusy("Извлекаю позиции…");
    try {
      const ex = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: bodyText }),
      });
      const exData = await ex.json();
      if (!ex.ok) {
        setBusy(null);
        return setError(exData.error ?? "Не удалось выделить позиции.");
      }
      // объект и заказчик из речи → поля КП; не затираем ручной ввод
      if (exData.object) setObjectName((prev) => prev || exData.object);
      if (exData.client) setClientName((prev) => prev || exData.client);

      setBusy("Подбираю по прайсу…");
      const mt = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: exData.items,
          ...(activeCategory ? { category: activeCategory } : {}),
        }),
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
            // ручная позиция при выбранной категории попадает в неё же
            category: b?.category ?? activeCategory ?? "Прочее",
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

  // Логотип для КП: файл → data URL (реквизиты/печать берутся из настроек)
  function onLogoFile(f: File) {
    if (f.size > 2_000_000) {
      setError("Логотип слишком большой (до 2 МБ).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogo(reader.result as string);
    reader.readAsDataURL(f);
  }

  async function save() {
    setError(null);
    setBusy("Сохраняю смету…");
    try {
      const res = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: objectName || "Смета",
          objectName: objectName || null,
          subject: subject || null,
          clientName: clientName || null,
          logo,
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

          {categories.length > 0 && (
            <section className="space-y-2 rounded-xl border bg-white p-5">
              <h2 className="text-sm font-medium text-gray-500">Категория подбора</h2>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Весь прайс</option>
                {categories.map((c) => (
                  <option key={c.category} value={c.category}>
                    {c.category} ({c.count})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500">
                Сужает поиск по прайсу до раздела. Можно и голосом — начните диктовку
                словами <b>«бери из дренажа…»</b>, категория подхватится сама.
              </p>
            </section>
          )}

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
              <span className="text-xs text-gray-500">Объект / название</span>
              <input
                value={objectName}
                onChange={(e) => setObjectName(e.target.value)}
                placeholder="Павлово 2"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-gray-500">Заказчик (необязательно)</span>
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="ИП Адилет"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs text-gray-500">
                Предмет — после слов «Коммерческое предложение»
              </span>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="по организации системы автоматического полива"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <div className="space-y-1 sm:col-span-2">
              <span className="text-xs text-gray-500">Логотип для КП (необязательно)</span>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                {logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logo}
                    alt="логотип"
                    className="h-12 w-auto max-w-32 rounded border object-contain"
                  />
                )}
                <UploadButton
                  accept="image/png,image/jpeg,image/svg+xml"
                  label={logo ? "Заменить" : "Загрузить логотип"}
                  onFile={onLogoFile}
                />
                {logo && (
                  <button
                    type="button"
                    onClick={() => setLogo(null)}
                    className="text-sm text-red-400 hover:text-red-600"
                  >
                    убрать
                  </button>
                )}
              </div>
              <p className="text-[11px] text-gray-400">
                Реквизиты и печать берутся из настроек компании. Лого — на этот КП.
              </p>
            </div>
          </section>

          <section className="space-y-3 rounded-xl border bg-white p-5">
            {category && (
              <p className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">
                  Подбор из категории: <b>{category}</b>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCategory("");
                    setStage("record");
                  }}
                  className="text-gray-500 underline hover:text-gray-900"
                >
                  искать по всему прайсу
                </button>
              </p>
            )}
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
                  <label className="min-w-0 space-y-1">
                    <span className="text-[11px] text-gray-400">Кол-во</span>
                    <input
                      type="number"
                      step="0.001"
                      value={l.qty}
                      onChange={(e) => update(i, { qty: Number(e.target.value) })}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="min-w-0 space-y-1">
                    <span className="text-[11px] text-gray-400">Ед.</span>
                    <input
                      value={l.unit}
                      onChange={(e) => update(i, { unit: e.target.value })}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="min-w-0 space-y-1">
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
