// Простой in-memory rate-limit (скользящее окно) для дорогих ИИ-роутов.
// Достаточно для одного инстанса (Railway): защищает от спама/выжигания бюджета.
// При нескольких инстансах/рестарте не сохраняется — для жёстких лимитов нужен Redis.

const hits = new Map<string, number[]>();

/**
 * Разрешён ли запрос. Возвращает { ok, retryAfter } (секунды до следующего слота).
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const from = now - windowMs;
  const arr = (hits.get(key) ?? []).filter((t) => t > from);

  if (arr.length >= limit) {
    const retryAfter = Math.ceil((arr[0] + windowMs - now) / 1000);
    hits.set(key, arr);
    return { ok: false, retryAfter: Math.max(1, retryAfter) };
  }

  arr.push(now);
  hits.set(key, arr);

  // лёгкая уборка, чтобы Map не рос бесконечно
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.every((t) => t <= from)) hits.delete(k);
  }
  return { ok: true, retryAfter: 0 };
}
