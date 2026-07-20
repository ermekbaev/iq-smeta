"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

// Событие установки PWA (нестандартный тип — объявляем минимально).
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Браузерные значения читаем через useSyncExternalStore, а не setState в эффекте:
// на сервере отдаём false, на клиенте — реальное состояние, без лишнего рендера.

const noopSubscribe = () => () => {};
const serverFalse = () => false;

// «appinstalled» уже случился в этой сессии: display-mode обновляется не сразу,
// поэтому запоминаем факт установки отдельно.
let installedInSession = false;

function subscribeInstalled(onChange: () => void) {
  const handler = () => {
    installedInSession = true;
    onChange();
  };
  window.addEventListener("appinstalled", handler);
  return () => window.removeEventListener("appinstalled", handler);
}

function getInstalled(): boolean {
  return (
    installedInSession ||
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function getIsIos(): boolean {
  return /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
}

export default function InstallPwaButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const installed = useSyncExternalStore(subscribeInstalled, getInstalled, serverFalse);
  const isIos = useSyncExternalStore(noopSubscribe, getIsIos, serverFalse);

  useEffect(() => {
    if (installed) return; // уже установлено — свою кнопку не готовим

    const onPrompt = (e: Event) => {
      e.preventDefault(); // не показываем авто-баннер, покажем свою кнопку
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, [installed]);

  if (installed) return null;

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  // Chrome/Android/десктоп — активная кнопка установки
  if (deferred) {
    return (
      <button
        onClick={install}
        className="block w-full rounded-xl border bg-white p-5 text-left shadow-sm hover:border-gray-400"
      >
        <div className="font-medium text-gray-900">📲 Установить приложение →</div>
        <div className="mt-1 text-sm text-gray-600">
          Добавить IQ Smeta на телефон / рабочий стол
        </div>
      </button>
    );
  }

  // iOS Safari (beforeinstallprompt не поддерживается) — инструкция
  if (isIos) {
    return (
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="font-medium text-gray-900">📲 Установить на телефон</div>
        <div className="mt-1 text-sm text-gray-600">
          В Safari: «Поделиться» → «На экран “Домой”».
        </div>
      </div>
    );
  }

  // остальные браузеры — краткая подсказка (кнопка появится, когда браузер разрешит)
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="font-medium text-gray-900">📲 Установить приложение</div>
      <div className="mt-1 text-sm text-gray-600">
        В меню браузера выберите «Установить приложение» / «На экран “Домой”».
      </div>
    </div>
  );
}
