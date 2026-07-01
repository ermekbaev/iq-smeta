import { describe, it, expect } from "vitest";
import { normalizeUnit, isKnownUnit } from "./units";

describe("normalizeUnit", () => {
  it("приводит словоформы к канону", () => {
    expect(normalizeUnit("мешков")).toBe("шт");
    expect(normalizeUnit("куба")).toBe("м3");
    expect(normalizeUnit("тонн")).toBe("т");
    expect(normalizeUnit("кубометр")).toBe("м3");
  });

  it("игнорирует регистр и пробелы", () => {
    expect(normalizeUnit("  МЕШОК ")).toBe("шт");
  });

  it("неизвестное возвращает как есть (в нижнем регистре)", () => {
    expect(normalizeUnit("погонный")).toBe("погонный");
  });
});

describe("isKnownUnit", () => {
  it("распознаёт известные единицы", () => {
    expect(isKnownUnit("мешков")).toBe(true);
    expect(isKnownUnit("куб")).toBe(true);
  });
  it("отвергает обычные слова", () => {
    expect(isKnownUnit("цемент")).toBe(false);
    expect(isKnownUnit("песка")).toBe(false);
  });
});
