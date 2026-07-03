// Утилиты для устойчивой работы с ИИ-провайдерами: параллелизм с лимитом и
// ретраи на rate-limit (429). Нужны для загрузки больших прайсов (PLAN 8).

/** Выполняет fn для каждого элемента с ограничением одновременных запросов. */
export async function concurrentMap<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return out;
}

function isRateLimit(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /\b429\b|RESOURCE_EXHAUSTED|rate.?limit|quota/i.test(msg);
}

// Провайдер подсказывает, сколько ждать («retry in 23s» / "retryDelay": "23s").
function hintedDelayMs(e: unknown): number | null {
  const msg = e instanceof Error ? e.message : String(e);
  const m =
    /retry in ([\d.]+)\s*s/i.exec(msg) || /retrydelay"?\s*:?\s*"?(\d+)\s*s/i.exec(msg);
  if (!m) return null;
  return Math.min(parseFloat(m[1]) * 1000 + 1000, 65000); // +1с запас, потолок 65с
}

/** Ретраи на rate-limit: ждём столько, сколько велит провайдер (иначе экспонента). */
export async function withRetry<R>(
  fn: () => Promise<R>,
  opts: { retries?: number; baseDelayMs?: number } = {}
): Promise<R> {
  const retries = opts.retries ?? 6;
  const base = opts.baseDelayMs ?? 800;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt === retries || !isRateLimit(e)) throw e;
      const delay = hintedDelayMs(e) ?? base * 2 ** attempt + Math.random() * 200;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/** Разбивает массив на чанки заданного размера. */
export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
