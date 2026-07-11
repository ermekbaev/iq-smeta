-- Старые глобальные уникальные ИНДЕКСЫ (name,unit) и (spoken_text) остались:
-- прошлая миграция дропала их как CONSTRAINT, но это индексы. Сносим правильно.
DROP INDEX IF EXISTS "price_items_name_unit_key";
DROP INDEX IF EXISTS "aliases_spoken_text_key";
