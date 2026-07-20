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

describe("parsePriceFile — начисления и кривые строки, а не позиции", () => {
  it("строки-начисления («Сметная прибыль») не попадают в каталог", () => {
    const buf = xlsx({
      "Смета": [
        ["№", "Наименование материалов, работ", "Ед. изм.", "Цена, руб", "Кол-во", "Итого, руб"],
        [1, "Песок карьерный", "м3", 2200, 5, 11000],
        [2, "Расходный и малоценный инвентарь и ср-ва защиты", 0.04, 33918.4, 1, 33918.4],
        [3, "Сметная прибыль", 0.06, 53421.48, 1, 53421.48],
        [4, "Накладные расходы", 0.1, 12000, 1, 12000],
        ["", "ИТОГО", "", 110339.88, "", 110339.88],
      ],
    });
    const r = parsePriceFile(buf);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ name: "Песок карьерный", unit: "м3", price: 2200 });
  });

  it("позиция со съехавшими колонками не становится категорией", () => {
    const buf = xlsx({
      "Смета": [
        ["№", "Наименование материалов, работ", "Ед. изм.", "Цена, руб", "Кол-во", "Итого, руб"],
        ["", "Материалы", "", "", "", ""], // настоящий раздел — только текст
        [1, "Песок карьерный", "м3", 2200, 5, 11000],
        // приложение-прайс внизу листа: цена уехала в колонку «Ед. изм.»
        ["", "Бордюр садовый 80 мм", 595],
        [2, "Щебень фр 5-20", "м3", 3650, 2, 7300],
      ],
    });
    const r = parsePriceFile(buf);
    expect(r.rows.map((x) => x.name)).toEqual(["Песок карьерный", "Щебень фр 5-20"]);
    // «Бордюр» не подменил раздел — обе позиции остались в «Материалы»
    expect(r.rows.map((x) => x.category)).toEqual(["Материалы", "Материалы"]);
    expect(r.skipped).toBe(1);
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
