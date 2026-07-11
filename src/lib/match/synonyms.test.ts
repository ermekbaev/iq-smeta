import { describe, it, expect } from "vitest";
import { applySynonyms } from "./synonyms";

describe("applySynonyms", () => {
  const groups = [
    ["сопло", "форсунка"],
    ["ёмкость", "бак", "накопитель"],
  ];

  it("без групп — текст не меняется", () => {
    expect(applySynonyms([], "форсунка")).toBe("форсунка");
  });

  it("нет совпадения — текст не меняется", () => {
    expect(applySynonyms(groups, "труба пнд 32")).toBe("труба пнд 32");
  });

  it("работает в обе стороны: форсунка → дописывает сопло", () => {
    expect(applySynonyms(groups, "нужна форсунка")).toBe("нужна форсунка сопло");
  });

  it("и наоборот: сопло → дописывает форсунка", () => {
    expect(applySynonyms(groups, "сопло ротатор")).toBe("сопло ротатор форсунка");
  });

  it("группа из трёх: бак → дописывает остальные (нормализованные)", () => {
    const r = applySynonyms(groups, "бак 2000");
    expect(r).toContain("емкость"); // ё нормализуется к е в приписке
    expect(r).toContain("накопитель");
  });

  it("не дублирует уже присутствующее слово", () => {
    // «ёмкость» уже в тексте → добавит только бак и накопитель, не саму ёмкость
    const r = applySynonyms(groups, "ёмкость r 2000");
    expect(r.match(/ёмкость/g)?.length).toBe(1);
  });

  it("ё нормализуется к е при сопоставлении", () => {
    // запрос с «е» вместо «ё» тоже цепляет группу «ёмкость…»
    expect(applySynonyms(groups, "емкость большая")).toContain("бак");
  });
});
