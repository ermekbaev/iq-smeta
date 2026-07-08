// Разовая переиндексация эмбеддингов прайса под текущего провайдера ИИ.
// Зачем: при смене провайдера (Gemini → Yandex) векторы несовместимы —
// они из разных пространств, семантический подбор ломается. Скрипт перечитывает
// все PriceItem и перезаписывает embedding через активный ai.embeddings.
//
// Запуск: npm run reindex   (провайдер берётся из .env — сейчас Yandex).
// Текст для эмбеддинга строится как в importPrice: "артикул + название".

import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { ai, EMBEDDING_DIM } from "@/lib/ai";
import { setEmbedding } from "@/lib/match";

async function main() {
  if (ai.embeddings.dimension !== EMBEDDING_DIM) {
    throw new Error(
      `Размерность провайдера (${ai.embeddings.dimension}) ≠ EMBEDDING_DIM (${EMBEDDING_DIM}).`
    );
  }

  const items = await prisma.priceItem.findMany({
    select: { id: true, article: true, name: true },
    orderBy: { name: "asc" },
  });
  if (items.length === 0) {
    console.log("Прайс пуст — нечего индексировать.");
    return;
  }

  console.log(
    `Позиций: ${items.length}. Провайдер эмбеддингов: dim=${ai.embeddings.dimension}. Считаю…`
  );

  const texts = items.map((i) => [i.article, i.name].filter(Boolean).join(" "));
  const vectors = await ai.embeddings.embedBatch(texts);

  if (vectors.length !== items.length) {
    throw new Error(`Ожидалось ${items.length} векторов, получено ${vectors.length}.`);
  }

  let done = 0;
  for (let i = 0; i < items.length; i++) {
    await setEmbedding(items[i].id, vectors[i]);
    done++;
    if (done % 50 === 0 || done === items.length) {
      console.log(`  записано ${done}/${items.length}`);
    }
  }

  console.log(`Готово: переиндексировано ${done} позиций.`);
}

main()
  .catch((e) => {
    console.error("Ошибка переиндексации:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
