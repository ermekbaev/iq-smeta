-- Поддержка реального формата прайса заказчика:
--  category: enum -> свободный текст (реальные группы/разделы);
--  + article (артикул), + cost (ОПТ-цена для расчёта маржи).
-- Данные тестовые/одноразовые — очищаем перед сменой типов.
TRUNCATE "estimate_items", "aliases", "estimates", "price_items" CASCADE;

ALTER TABLE "price_items"
  ADD COLUMN "article" TEXT,
  ADD COLUMN "cost" DECIMAL(12,2);

ALTER TABLE "price_items"
  ALTER COLUMN "category" DROP DEFAULT,
  ALTER COLUMN "category" TYPE TEXT USING "category"::text,
  ALTER COLUMN "category" SET DEFAULT 'Прочее';

ALTER TABLE "estimate_items"
  ALTER COLUMN "category" DROP DEFAULT,
  ALTER COLUMN "category" TYPE TEXT USING "category"::text,
  ALTER COLUMN "category" SET DEFAULT 'Прочее';

DROP TYPE "Category";
