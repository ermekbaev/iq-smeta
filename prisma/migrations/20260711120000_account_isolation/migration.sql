-- Изоляция данных по аккаунту (user_id) + словарь синонимов.
-- Существующие данные привязываются к первому (владельцу IQ) аккаунту.

-- ===== price_items =====
ALTER TABLE "price_items" ADD COLUMN "user_id" TEXT;
UPDATE "price_items" SET "user_id" = (SELECT "id" FROM "users" ORDER BY "created_at" ASC LIMIT 1);
ALTER TABLE "price_items" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "price_items" DROP CONSTRAINT IF EXISTS "price_items_name_unit_key";
ALTER TABLE "price_items" ADD CONSTRAINT "price_items_user_id_name_unit_key" UNIQUE ("user_id", "name", "unit");
CREATE INDEX "price_items_user_id_idx" ON "price_items"("user_id");
ALTER TABLE "price_items" ADD CONSTRAINT "price_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===== aliases =====
ALTER TABLE "aliases" ADD COLUMN "user_id" TEXT;
UPDATE "aliases" SET "user_id" = (SELECT "id" FROM "users" ORDER BY "created_at" ASC LIMIT 1);
ALTER TABLE "aliases" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "aliases" DROP CONSTRAINT IF EXISTS "aliases_spoken_text_key";
ALTER TABLE "aliases" ADD CONSTRAINT "aliases_user_id_spoken_text_key" UNIQUE ("user_id", "spoken_text");
CREATE INDEX "aliases_user_id_idx" ON "aliases"("user_id");
ALTER TABLE "aliases" ADD CONSTRAINT "aliases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===== company_settings =====
ALTER TABLE "company_settings" ADD COLUMN "user_id" TEXT;
UPDATE "company_settings" SET "user_id" = (SELECT "id" FROM "users" ORDER BY "created_at" ASC LIMIT 1);
ALTER TABLE "company_settings" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_user_id_key" UNIQUE ("user_id");
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===== synonyms =====
CREATE TABLE "synonyms" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "terms" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "synonyms_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "synonyms_user_id_idx" ON "synonyms"("user_id");
ALTER TABLE "synonyms" ADD CONSTRAINT "synonyms_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
