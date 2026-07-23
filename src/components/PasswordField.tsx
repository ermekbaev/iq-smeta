"use client";

import { useId, useState } from "react";

// Поле пароля с «глазком» (показать/скрыть). Неуправляемое — значение уходит
// в form action по name, поэтому годится и для серверных форм входа/регистрации.
export default function PasswordField({
  name = "password",
  label = "Пароль",
  minLength,
  autoComplete,
}: {
  name?: string;
  label?: string;
  minLength?: number;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  const id = useId();

  return (
    <label className="block space-y-1">
      <span className="text-sm text-gray-700">{label}</span>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={show ? "text" : "password"}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          className="w-full rounded border border-gray-300 px-3 py-2 pr-10 text-gray-900 outline-none focus:border-gray-900"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Скрыть пароль" : "Показать пароль"}
          aria-pressed={show}
          title={show ? "Скрыть пароль" : "Показать пароль"}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-700"
        >
          {show ? (
            // глаз перечёркнут
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a13.16 13.16 0 0 1-1.67 2.68" />
              <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 8 10 8a9.74 9.74 0 0 0 5.39-1.61" />
              <line x1="2" y1="2" x2="22" y2="22" />
            </svg>
          ) : (
            // глаз открыт
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    </label>
  );
}
