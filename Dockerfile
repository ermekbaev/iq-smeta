# Прод-образ IQ SMETA: Next.js 16 + Prisma + Puppeteer.
# Puppeteer тянет СВОЙ Chrome (совместимый с версией пакета) — надёжнее, чем
# системный chromium (тот в контейнере падал с "Failed to launch ... Code: null").
FROM node:22-bookworm-slim

# OS-библиотеки, нужные Chrome (сам браузер скачает Puppeteer).
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates fonts-liberation fonts-dejavu \
      libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
      libdbus-1-3 libxcb1 libxkbcommon0 libx11-6 libxcomposite1 libxdamage1 \
      libxext6 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 \
      libasound2 libatspi2.0-0 libxshmfence1 \
 && rm -rf /var/lib/apt/lists/*

ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    PUPPETEER_CACHE_DIR=/app/.cache/puppeteer

WORKDIR /app

# Схема + конфиг Prisma нужны до npm ci: postinstall запускает prisma generate.
COPY package*.json prisma.config.ts ./
COPY prisma ./prisma
# Зависимости + гарантированно скачиваем Chrome в PUPPETEER_CACHE_DIR.
RUN npm ci --include=dev && npx puppeteer browsers install chrome

# Остальные исходники + сборка.
COPY . .
# Заглушка DATABASE_URL только на время сборки (к БД сборка не подключается).
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npm run build

EXPOSE 3000
# Миграции + запуск (prod-сервер Next).
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
