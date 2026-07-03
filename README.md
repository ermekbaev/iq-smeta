# IQ SMETA

Голосовое создание смет: диктовка → ASR → извлечение позиций (LLM) → подбор по
прайсу (pgvector) → фирменный PDF. Сайт + PWA. Подробности — в [PLAN.md](PLAN.md).

## Стек
Next.js 16 (App Router) · Prisma 7 + PostgreSQL + pgvector · NextAuth v5 ·
адаптеры ИИ (ASR/LLM/embeddings) со сменой провайдера (dev — mock, прод — Яндекс/GigaChat).

## Запуск (разработка)

```bash
cp .env.example .env        # при необходимости поправить
npm install
npm run db:up               # Postgres+pgvector в Docker (порт 5433)
npm run db:migrate          # применить миграции
npm run db:seed             # создать админа
npm run dev
```

Админ по умолчанию: `admin@iqsmeta.local` / `admin123` (см. `prisma/seed.ts`).

## Состояние

**Этап 1 (готово):** каркас, авторизация, загрузка/редактирование прайса
(Excel/CSV), запись голоса → текст через ASR-адаптер.

**Этап 2 (готово, на mock-провайдерах):** извлечение позиций (LLM), подбор по
прайсу (pgvector + нечёткое + порог уверенности), обучение через aliases, сборка
сметы с группировкой по категориям, фирменный PDF (Puppeteer), PWA (установка).
Полный поток: `/record` → запись/текст → черновик с подбором → смета → PDF.

**Дальше:** подключить ключи Яндекс Cloud для прод-ИИ в `.env`
вместо mock; реальный прайс и надиктовки заказчика для настройки подбора;
реквизиты/логотип в шаблон PDF (`src/lib/pdf/template.ts`).

## Заметки
- Размерность вектора зафиксирована: `vector(256)` (под YandexGPT Embeddings).
  Смена провайдера → менять `EMBEDDING_DIM` в `src/lib/ai/types.ts` И схему, затем миграция.
- Порт БД 5433 (5432 часто занят системным PostgreSQL).
