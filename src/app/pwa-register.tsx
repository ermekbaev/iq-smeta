"use client";

import { useEffect } from "react";

// Регистрация service worker для установки приложения (PLAN 3.6).
export default function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* регистрация не критична — приложение работает и без SW */
      });
    }
  }, []);
  return null;
}
