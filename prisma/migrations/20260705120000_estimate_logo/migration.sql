-- Логотип КП на уровне сметы (data URL). Реквизиты/печать/подпись — в конфиге бренда.
ALTER TABLE "estimates" ADD COLUMN "logo" TEXT;
