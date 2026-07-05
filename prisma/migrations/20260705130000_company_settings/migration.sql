-- Реквизиты компании/ИП для КП (синглтон). Картинки — data URL в TEXT.
CREATE TABLE "company_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "name" TEXT NOT NULL DEFAULT '',
    "inn" TEXT,
    "ogrn" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "bank_name" TEXT,
    "bank_account" TEXT,
    "bank_cor_account" TEXT,
    "bank_bik" TEXT,
    "signer" TEXT,
    "logo" TEXT,
    "stamp" TEXT,
    "signature" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);
