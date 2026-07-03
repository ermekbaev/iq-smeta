import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parsePriceFile } from "./parse";

const csv = (s: string) => Buffer.from(s, "utf8");

// собирает реальный .xlsx-буфер из листов { name: rows[][] }
function xlsx(sheets: Record<string, (string | number)[][]>): Buffer {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  }
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("parsePriceFile — плоский CSV", () => {
  it("разбирает колонки, категория из колонки", () => {
    const r = parsePriceFile(
      csv(
        "Наименование,Ед.,Цена,Категория\n" +
          "Цемент М500,мешок,450,Материалы\n" +
          "Доставка,шт,3000,Доставка\n"
      ),
      { csv: true }
    );
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({
      article: null,
      name: "Цемент М500",
      unit: "мешок",
      price: 450,
      cost: null,
      category: "Материалы",
    });
    expect(r.rows[1].category).toBe("Доставка");
  });

  it("пропускает строки без наименования или цены (плоский режим)", () => {
    const r = parsePriceFile(
      csv(
        "Наименование,Ед.,Цена,Категория\n" +
          "Цемент,шт,450,Материалы\n" +
          ",кг,,Материалы\n" + // нет имени — не считается
          "Брак,шт,,Работы\n" // нет цены — skipped
      ),
      { csv: true }
    );
    expect(r.rows).toHaveLength(1);
    expect(r.skipped).toBe(1);
  });

  it("синонимы заголовков и чистка цены; без колонки категории → Прочее", () => {
    const r = parsePriceFile(csv("Название,Единица,Стоимость\nПесок,м3,1 200 руб\n"), {
      csv: true,
    });
    expect(r.rows[0]).toMatchObject({ name: "Песок", unit: "м3", price: 1200 });
    expect(r.rows[0].category).toBe("Прочее");
  });

  it("без колонок имени/цены → пусто", () => {
    const r = parsePriceFile(csv("Foo,Bar\n1,2\n"), { csv: true });
    expect(r.rows).toHaveLength(0);
  });
});

describe("parsePriceFile — реальный формат (XLSX)", () => {
  it("заголовок не в 1-й строке, строки-разделы → категории, РРЦ+ОПТ, артикул", () => {
    const buf = xlsx({
      "Прайс": [
        ["ООО IQ", "", "", "", "", ""], // реквизиты сверху
        ["", "", "", "", "", ""],
        ["Артикул", "Наименование", "Ед.изм.", "РРЦ, ₽", "Оптовая скидка", "Оптовая цена, ₽"],
        ["", "Светильники", "", "", "", ""], // раздел
        ["CALLA", "SGL CALLA Светильник", "шт", 4980, 0.25, 3735],
        ["CALLA-02", "SGL CALLA-02", "шт", 7930, 0.25, 5947.5],
        ["", "Кабель", "", "", "", ""], // раздел
        ["KAB-3x2.5", "Кабель ВВГ 3x2.5", "м", 120, 0.25, 90],
      ],
      // лист-смета (есть «Кол-во») — должен пропуститься
      "Смета": [
        ["", "Артикул", "Наименование", "Кол-во", "Ед.изм.", "Цена", "Сумма"],
        ["", "CALLA", "SGL CALLA", 1, "шт", 4980, 4980],
      ],
    });

    const r = parsePriceFile(buf);
    expect(r.sheets).toEqual(["Прайс"]); // смета пропущена
    expect(r.rows).toHaveLength(3);

    expect(r.rows[0]).toMatchObject({
      article: "CALLA",
      name: "SGL CALLA Светильник",
      unit: "шт",
      price: 4980, // РРЦ
      cost: 3735, // ОПТ (не «оптовая скидка»)
      category: "Светильники",
    });
    expect(r.rows[1].category).toBe("Светильники");
    expect(r.rows[2]).toMatchObject({
      article: "KAB-3x2.5",
      category: "Кабель",
      price: 120,
      cost: 90,
      unit: "м",
    });
  });
});
