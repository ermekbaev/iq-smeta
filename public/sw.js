// Service worker IQ SMETA (PLAN 3.6).
// Базовый офлайн-shell: кэшируем оболочку. Обработка (ASR/LLM/подбор) — онлайн.
const CACHE = "iq-smeta-shell-v1";
const SHELL = ["/", "/login", "/manifest.json", "/icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  // Только GET и тот же origin. API и POST — всегда сеть (нужна онлайн-обработка).
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }
  if (new URL(request.url).pathname.startsWith("/api/")) return;

  // network-first: свежесть важнее, офлайн — отдаём из кэша
  e.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
        return res;
      })
      .catch(() => caches.match(request).then((r) => r ?? caches.match("/")))
  );
});
