import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7: строка подключения и seed живут здесь, а не в schema.prisma.
// Driver adapter для рантайма настраивается в PrismaClient (см. src/lib/prisma.ts).
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
