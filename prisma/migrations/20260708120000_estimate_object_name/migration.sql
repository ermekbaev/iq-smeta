-- Объект/название сметы (для строки «Объект —» КП и имени файла),
-- отдельно от заказчика (client_name).
ALTER TABLE "estimates" ADD COLUMN "object_name" TEXT;
