-- Общая база синонимов: флаг is_global (применяется при подборе у всех аккаунтов)
ALTER TABLE "synonyms" ADD COLUMN "is_global" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "synonyms_is_global_idx" ON "synonyms" ("is_global");
