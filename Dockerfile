# Прод-образ приложения IQ SMETA: Next.js 16 + Prisma + Puppeteer(Chromium).
# Chromium ставим системный (для PDF-КП), Puppeteer его не качает.
FROM node:22-bookworm-slim

# Системный Chromium + шрифты/библиотеки, нужные для рендера PDF.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      fonts-liberation fonts-dejavu \
      ca-certificates \
      libnss3 libatk-bridge2.0-0 libatk1.0-0 libcups2 libdrm2 \
      libxcomposite1 libxdamage1 libxrandr2 libgbm1 libxkbcommon0 \
      libpangocairo-1.0-0 libgtk-3-0 libasound2 \
 && rm -rf /var/lib/apt/lists/*

# Puppeteer использует системный Chromium, свой не скачивает.
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

WORKDIR /app

# Зависимости (devDeps тоже — нужны prisma CLI и сборка Next).
COPY package*.json ./
RUN npm ci --include=dev

# Исходники + сборка.
COPY . .
# Заглушка DATABASE_URL только на время сборки (к БД сборка не подключается).
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npm run build

EXPOSE 3000
# Миграции + запуск (prod-сервер Next).
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
