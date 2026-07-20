// Разовая проверка: как голосовые команды ложатся на РЕАЛЬНЫЕ категории прайса.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { detectCategoryCommand } from "../src/lib/match/category";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const rows = await prisma.priceItem.groupBy({
    by: ["category"],
    _count: { _all: true },
    orderBy: { category: "asc" },
  });
  const cats = rows.map((r) => r.category);
  console.log("Категории в базе:", rows.map((r) => `${r.category} (${r._count._all})`).join(", "));
  console.log("");

  for (const c of cats) {
    const lower = c.toLowerCase();
    const phrases = [
      `бери из ${lower}, 10 труб`,
      `возьми по ${lower}: 5 колодцев`,
      `категория ${lower}, 3 метра`,
    ];
    for (const p of phrases) {
      const r = detectCategoryCommand(p, cats);
      const ok = r.category === c ? "✓" : "✗";
      console.log(`${ok} «${p}» → ${r.category ?? "—"} | остаток: «${r.text}»`);
    }
  }

  console.log("\nЛожные срабатывания (команды нет — категория должна быть пустой):");
  for (const p of [
    "10 мешков цемента, 3 куба песка",
    "20 метров трубы из ПНД, 5 колодцев",
    "доставка самосвалом по объекту",
  ]) {
    const r = detectCategoryCommand(p, cats);
    console.log(`${r.category === null ? "✓" : "✗"} «${p}» → ${r.category ?? "—"}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
