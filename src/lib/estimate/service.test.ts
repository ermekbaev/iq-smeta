import { describe, it, expect } from "vitest";
import { isWorkCategory, groupByCategory } from "./service";

describe("isWorkCategory", () => {
  it("работы/услуги/монтаж/доставка/земляные → true", () => {
    for (const c of ["Монтаж свай", "Земляные работы", "Доставка", "Пусконаладка", "Инженерные услуги"]) {
      expect(isWorkCategory(c)).toBe(true);
    }
  });
  it("материалы/оборудование → false", () => {
    for (const c of ["Дождеватели", "Светильники", "Кабель", "Ёмкости"]) {
      expect(isWorkCategory(c)).toBe(false);
    }
  });
});

describe("groupByCategory", () => {
  const items = [
    { name: "Дождеватель", qty: 2, unit: "шт", price: 500, sum: 1000, category: "Дождеватели" },
    { name: "Сопло", qty: 10, unit: "шт", price: 100, sum: 1000, category: "Дождеватели" },
    { name: "Копка траншей", qty: 40, unit: "м", price: 850, sum: 34000, category: "Земляные работы" },
  ];

  it("группирует по категориям, сохраняя порядок первого появления", () => {
    const g = groupByCategory(items);
    expect(g.map((x) => x.category)).toEqual(["Дождеватели", "Земляные работы"]);
  });

  it("считает подытог по разделу", () => {
    const g = groupByCategory(items);
    expect(g[0].subtotal).toBe(2000); // 1000 + 1000
    expect(g[1].subtotal).toBe(34000);
  });

  it("проставляет флаг isWork по названию раздела", () => {
    const g = groupByCategory(items);
    expect(g[0].isWork).toBe(false); // Дождеватели
    expect(g[1].isWork).toBe(true); // Земляные работы
  });

  it("пустой список → пустой результат", () => {
    expect(groupByCategory([])).toEqual([]);
  });
});
