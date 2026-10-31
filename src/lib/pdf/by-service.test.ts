import { describe, it, expect } from "vitest";
import { sectionsByService } from "./by-service";
import type { EstimateGroup } from "@/lib/estimate/service";

const g = (category: string, names: [string, number][], isWork = false): EstimateGroup => ({
  category,
  label: category,
  isWork,
  lines: names.map(([name, sum]) => ({ article: null, name, qty: 1, unit: "шт", price: sum, sum })),
  subtotal: names.reduce((a, [, s]) => a + s, 0),
});

describe("общая смета по услугам", () => {
  it("одна услуга — без разбивки", () => {
    expect(sectionsByService([g("Дождеватели (HUNTER)", [["Дождеватель PGP", 1000]])])).toBeNull();
  });

  it("несколько услуг — разделы с подытогами, общие работы — построчно", () => {
    const s = sectionsByService([
      g("Дождеватели (HUNTER)", [["Дождеватель PGP", 1000]]),
      g("Светильники грунтовые", [["Светильник SWG", 3000]]),
      g("Работы", [["Монтаж дождевателя", 500], ["Монтаж светильника", 700], ["Вывоз мусора", 200]], true),
    ])!;
    expect(s.map((x) => x.label)).toEqual(["Автополив", "Освещение", "Общее"]);
    expect(s.map((x) => x.subtotal)).toEqual([1500, 3700, 200]);
  });
});
