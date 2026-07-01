-- Смена размерности эмбеддингов 1024 -> 768 (dev: Gemini text-embedding-004).
-- Prisma не диффит Unsupported(vector(N)) автоматически — миграция написана вручную.
-- Тестовые данные одноразовые: чистим, чтобы не конфликтовать с новой размерностью.
TRUNCATE "estimate_items", "aliases", "estimates", "price_items" CASCADE;

ALTER TABLE "price_items" ALTER COLUMN "embedding" TYPE vector(768);
