"use client";

import { useState } from "react";

export default function PasswordChange() {
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function changePassword() {
    setMsg(null);
    if (pw.next.length < 8) return setMsg("Новый пароль — минимум 8 символов.");
    if (pw.next !== pw.confirm) return setMsg("Пароли не совпадают.");
    setSaving(true);
    const res = await fetch("/api/settings/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: pw.current, newPassword: pw.next }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) {
      setPw({ current: "", next: "", confirm: "" });
      setMsg("Пароль изменён.");
    } else {
      setMsg(data.error ?? "Не удалось сменить пароль.");
    }
  }

  return (
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
          disabled={saving || !pw.current || !pw.next}
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {saving ? "Меняю…" : "Сменить пароль"}
        </button>
        {msg && <span className="text-sm text-gray-700">{msg}</span>}
      </div>
    </section>
  );
}
