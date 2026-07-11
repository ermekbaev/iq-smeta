"use client";

import { useEffect, useState } from "react";
import SynonymsManager from "./SynonymsManager";

interface Settings {
  name: string;
  inn: string;
  ogrn: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  bankName: string;
  bankAccount: string;
  bankCorAccount: string;
  bankBik: string;
  signer: string;
  logo: string | null;
  stamp: string | null;
  signature: string | null;
}

const EMPTY: Settings = {
  name: "", inn: "", ogrn: "", address: "", phone: "", email: "", website: "",
  bankName: "", bankAccount: "", bankCorAccount: "", bankBik: "", signer: "",
  logo: null, stamp: null, signature: null,
};

type ImgField = "logo" | "stamp" | "signature";

export default function CompanySettingsPage() {
  const [s, setS] = useState<Settings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/company")
      .then((r) => r.json())
      .then((d: Record<string, unknown>) => {
        const next = { ...EMPTY };
        for (const k of Object.keys(EMPTY) as (keyof Settings)[]) {
          const v = d[k];
          if (k === "logo" || k === "stamp" || k === "signature") {
            next[k] = (typeof v === "string" ? v : null) as never;
          } else {
            next[k] = (typeof v === "string" ? v : "") as never;
          }
        }
        setS(next);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = (k: keyof Settings, v: string | null) => setS((p) => ({ ...p, [k]: v }));

  function onImg(field: ImgField, e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2_000_000) {
      setMsg("Файл слишком большой (до 2 МБ).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set(field, reader.result as string);
    reader.readAsDataURL(f);
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/settings/company", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    });
    setSaving(false);
    setMsg(res.ok ? "Сохранено." : "Не удалось сохранить.");
  }

  // --- Смена пароля ---
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);

  async function changePassword() {
    setPwMsg(null);
    if (pw.next.length < 8) return setPwMsg("Новый пароль — минимум 8 символов.");
    if (pw.next !== pw.confirm) return setPwMsg("Пароли не совпадают.");
    setPwSaving(true);
    const res = await fetch("/api/settings/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: pw.current, newPassword: pw.next }),
    });
    const data = await res.json().catch(() => ({}));
    setPwSaving(false);
    if (res.ok) {
      setPw({ current: "", next: "", confirm: "" });
      setPwMsg("Пароль изменён.");
    } else {
      setPwMsg(data.error ?? "Не удалось сменить пароль.");
    }
  }

  if (loading) return <p className="text-sm text-gray-500">Загрузка…</p>;

  const field = (label: string, k: keyof Settings, ph = "") => (
    <label className="space-y-1">
      <span className="text-xs text-gray-500">{label}</span>
      <input
        value={(s[k] as string) ?? ""}
        onChange={(e) => set(k, e.target.value)}
        placeholder={ph}
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
      />
    </label>
  );

  const imgBlock = (label: string, k: ImgField, hint: string) => (
    <div className="space-y-2">
      <span className="text-xs text-gray-500">{label}</span>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {s[k] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={s[k] as string}
            alt={label}
            className="h-16 w-auto max-w-40 rounded border object-contain"
          />
        )}
        <input
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          onChange={(e) => onImg(k, e)}
          className="max-w-full text-sm"
        />
        {s[k] && (
          <button
            type="button"
            onClick={() => set(k, null)}
            className="text-sm text-red-400 hover:text-red-600"
          >
            убрать
          </button>
        )}
      </div>
      <p className="text-[11px] text-gray-400">{hint}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Настройки компании</h1>
        <button
          onClick={save}
          disabled={saving}
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {saving ? "Сохраняю…" : "Сохранить"}
        </button>
      </div>
      <p className="text-sm text-gray-500">
        Реквизиты, логотип и печать подставляются в PDF/КП. Один бренд — разделение по
        направлениям будет отдельной фазой.
      </p>
      {msg && <p className="text-sm text-gray-700">{msg}</p>}

      <section className="space-y-4 rounded-xl border bg-white p-5">
        <h2 className="font-medium text-gray-900">Общие сведения</h2>
        {field("Наименование (ИП/компания)", "name", "ИП Мохов Юрий …")}
        <div className="grid gap-3 sm:grid-cols-2">
          {field("ИНН", "inn")}
          {field("ОГРНИП / ОГРН", "ogrn")}
        </div>
        {field("Подписант (под подписью)", "signer", "ИП Мохов Ю. А.")}
      </section>

      <section className="space-y-4 rounded-xl border bg-white p-5">
        <h2 className="font-medium text-gray-900">Контакты и адрес</h2>
        {field("Адрес", "address")}
        <div className="grid gap-3 sm:grid-cols-3">
          {field("Телефон", "phone")}
          {field("Email", "email")}
          {field("Сайт", "website", "iqpoliv.ru")}
        </div>
      </section>

      <section className="space-y-4 rounded-xl border bg-white p-5">
        <h2 className="font-medium text-gray-900">Банковские реквизиты</h2>
        {field("Банк", "bankName")}
        <div className="grid gap-3 sm:grid-cols-3">
          {field("Р/с", "bankAccount")}
          {field("БИК", "bankBik")}
          {field("К/с", "bankCorAccount")}
        </div>
      </section>

      <section className="space-y-5 rounded-xl border bg-white p-5">
        <h2 className="font-medium text-gray-900">Логотип, печать, подпись</h2>
        {imgBlock("Логотип (по умолчанию)", "logo", "PNG с прозрачным фоном. Используется, если у сметы нет своего лого.")}
        <div className="grid gap-5 sm:grid-cols-2">
          {imgBlock("Печать", "stamp", "PNG с прозрачным фоном.")}
          {imgBlock("Подпись", "signature", "PNG с прозрачным фоном.")}
        </div>
      </section>

      <section className="space-y-4 rounded-xl border bg-white p-5">
        <h2 className="font-medium text-gray-900">Смена пароля</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs text-gray-500">Текущий пароль</span>
            <input
              type="password"
              autoComplete="current-password"
              value={pw.current}
              onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-gray-500">Новый пароль</span>
            <input
              type="password"
              autoComplete="new-password"
              value={pw.next}
              onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-gray-500">Повторите новый</span>
            <input
              type="password"
              autoComplete="new-password"
              value={pw.confirm}
              onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={changePassword}
            disabled={pwSaving || !pw.current || !pw.next}
            className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {pwSaving ? "Меняю…" : "Сменить пароль"}
          </button>
          {pwMsg && <span className="text-sm text-gray-700">{pwMsg}</span>}
        </div>
      </section>

      <SynonymsManager />
    </div>
  );
}
