-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('MATERIALS', 'WORKS', 'EQUIPMENT', 'DELIVERY', 'OVERHEAD');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ADMIN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "category" "Category" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "embedding" vector(1024),

    CONSTRAINT "price_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aliases" (
    "id" TEXT NOT NULL,
    "spoken_text" TEXT NOT NULL,
    "price_item_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimates" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "client_name" TEXT,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_items" (
    "id" TEXT NOT NULL,
    "estimate_id" TEXT NOT NULL,
    "price_item_id" TEXT,
    "name" TEXT NOT NULL,
    "qty" DECIMAL(12,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "sum" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "estimate_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "price_items_category_idx" ON "price_items"("category");

-- CreateIndex
CREATE UNIQUE INDEX "price_items_name_unit_key" ON "price_items"("name", "unit");

-- CreateIndex
CREATE UNIQUE INDEX "aliases_spoken_text_key" ON "aliases"("spoken_text");

-- CreateIndex
CREATE INDEX "estimates_user_id_idx" ON "estimates"("user_id");

-- CreateIndex
CREATE INDEX "estimate_items_estimate_id_idx" ON "estimate_items"("estimate_id");

-- AddForeignKey
ALTER TABLE "aliases" ADD CONSTRAINT "aliases_price_item_id_fkey" FOREIGN KEY ("price_item_id") REFERENCES "price_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_items" ADD CONSTRAINT "estimate_items_estimate_id_fkey" FOREIGN KEY ("estimate_id") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_items" ADD CONSTRAINT "estimate_items_price_item_id_fkey" FOREIGN KEY ("price_item_id") REFERENCES "price_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
