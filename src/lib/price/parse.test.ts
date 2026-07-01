import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { Category } from "@prisma/client";
import { parsePriceFile } from "./parse";

const csv = (s: string) => Buffer.from(s, "utf8");

// собирает реальный .xlsx-буфер из строк
function xlsx(rows: (string | number)[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Прайс");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("parsePriceFile (CSV)", () => {
  it("разбирает колонки и маппит категории", () => {
    const r = parsePriceFile(
      csv(
        "Наименование,Ед.,Цена,Категория\n" +
          "Цемент М500,мешок,450,Материалы\n" +
          "Доставка,шт,3000,Доставка\n" +
          "Кладка,м2,800,Работы\n"
      ),
      { csv: true }
    );
    expect(r.rows).toHaveLength(3);
    expect(r.skipped).toBe(0);
    expect(r.rows[0]).toMatchObject({
      name: "Цемент М500",
      unit: "мешок",
      price: 450,
      category: Category.MATERIALS,
    });
    expect(r.rows[1].category).toBe(Category.DELIVERY);
    expect(r.rows[2].category).toBe(Category.WORKS);
  });

  it("пропускает строки с данными, но без наименования или цены", () => {
    // строки не полностью пустые (иначе их отбросит парсер xlsx до подсчёта)
    const r = parsePriceFile(
      csv(
        "Наименование,Ед.,Цена,Категория\n" +
          "Цемент,шт,450,Материалы\n" +
          ",кг,,Материалы\n" + // нет имени и цены
          "Брак,шт,,Работы\n" // нет цены
      ),
      { csv: true }
    );
    expect(r.rows).toHaveLength(1);
    expect(r.skipped).toBe(2);
  });

  it("понимает синонимы заголовков и чистит цену", () => {
    const r = parsePriceFile(
      csv("Название,Единица,Стоимость\nПесок,м3,1 200 руб\n"),
      { csv: true }
    );
    expect(r.rows[0]).toMatchObject({ name: "Песок", unit: "м3", price: 1200 });
  });

  it("неизвестная категория → Материалы по умолчанию", () => {
    const r = parsePriceFile(csv("Наименование,Цена\nГвозди,100\n"), { csv: true });
    expect(r.rows[0].category).toBe(Category.MATERIALS);
    expect(r.rows[0].unit).toBe("шт");
  });

  it("без колонок имени/цены → пусто", () => {
    const r = parsePriceFile(csv("Foo,Bar\n1,2\n"), { csv: true });
    expect(r.rows).toHaveLength(0);
  });
});

describe("parsePriceFile (XLSX)", () => {
  it("разбирает настоящий Excel-файл", () => {
    const buf = xlsx([
      ["Наименование", "Ед.", "Цена", "Категория"],
      ["Цемент М500", "мешок", 460, "Материалы"],
      ["Доставка самосвалом", "шт", 3200, "Доставка"],
      ["Кладка кирпича", "м2", 1900, "Работы"],
    ]);
    const r = parsePriceFile(buf); // csv:false (по умолчанию)
    expect(r.rows).toHaveLength(3);
    expect(r.rows[0]).toMatchObject({
      name: "Цемент М500",
      unit: "мешок",
      price: 460,
      category: Category.MATERIALS,
    });
    expect(r.rows[1].category).toBe(Category.DELIVERY);
    expect(r.rows[2].category).toBe(Category.WORKS);
  });

  it("числовая цена из Excel-ячейки сохраняется", () => {
    const buf = xlsx([
      ["Название", "Единица", "Стоимость"],
      ["Песок", "м3", 1150.5],
    ]);
    const r = parsePriceFile(buf);
    expect(r.rows[0].price).toBe(1150.5);
  });
});
