import { describe, it, expect } from "vitest";
import { aggregateReview } from "./synonyms-review";

describe("aggregateReview — обзор чужих словарей", () => {
  it("схлопывает одинаковые группы разных аккаунтов (порядок/регистр не важны)", () => {
    const r = aggregateReview(
      [
        { terms: ["сопло", "форсунка"], email: "a@x.ru" },
        { terms: ["Форсунка", " СОПЛО "], email: "b@x.ru" },
      ],
      []
    );
    expect(r).toHaveLength(1);
    expect(r[0].terms).toEqual(["сопло", "форсунка"]);
    expect(r[0].accounts).toEqual(["a@x.ru", "b@x.ru"]);
  });

  it("помечает наличие в общей базе: покрыта, если общая группа включает все слова", () => {
    const r = aggregateReview(
      [
        { terms: ["сопло", "форсунка"], email: "a@x.ru" }, // ⊂ общей → покрыта
        { terms: ["бак", "ёмкость"], email: "a@x.ru" }, // нет в общей
      ],
      [["сопло", "форсунка", "распылитель"]]
    );
    const byName = Object.fromEntries(r.map((i) => [i.terms.join("+"), i.inGlobal]));
    expect(byName["сопло+форсунка"]).toBe(true);
    expect(byName["бак+ёмкость"]).toBe(false);
  });

  it("частичное пересечение с общей базой не считается покрытием", () => {
    const r = aggregateReview(
      [{ terms: ["сопло", "распылитель"], email: "a@x.ru" }],
      [["сопло", "форсунка"]] // «распылителя» нет
    );
    expect(r[0].inGlobal).toBe(false);
  });

  it("сортировка: сначала отсутствующие в общей базе, внутри — по числу аккаунтов", () => {
    const r = aggregateReview(
      [
        { terms: ["сопло", "форсунка"], email: "a@x.ru" }, // покрыта
        { terms: ["бак", "ёмкость"], email: "a@x.ru" }, // новая, 1 аккаунт
        { terms: ["лоток", "жёлоб"], email: "b@x.ru" }, // новая, 2 аккаунта
        { terms: ["жёлоб", "лоток"], email: "c@x.ru" },
      ],
      [["сопло", "форсунка"]]
    );
    expect(r.map((i) => i.terms.join("+"))).toEqual([
      "жёлоб+лоток", // новая, чаще просят
      "бак+ёмкость", // новая
      "сопло+форсунка", // уже в общей — в конец
    ]);
  });

  it("группы из одного слова отбрасываются", () => {
    expect(aggregateReview([{ terms: ["сопло", " "], email: "a@x.ru" }], [])).toEqual([]);
  });
});
