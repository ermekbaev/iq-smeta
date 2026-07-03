-- Switch embeddings from Gemini/GigaChat experiments to YandexGPT textEmbedding.
-- Existing vectors have a different dimensionality, so keep price rows but clear
-- embeddings. Re-upload/reindex the price list after deploy to fill vector(256).
ALTER TABLE "price_items"
  ALTER COLUMN "embedding" TYPE vector(256) USING NULL::vector(256);
