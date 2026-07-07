"use client";

import { useEffect, useState } from "react";

// Событие установки PWA (нестандартный тип — объявляем минимально).
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPwaButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    // уже открыто как установленное приложение?
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) {
      setInstalled(true);
      return;
    }

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIos(/iphone|ipad|ipod/.test(ua));

    const onPrompt = (e: Event) => {
      e.preventDefault(); // не показываем авто-баннер, покажем свою кнопку
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

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
