import { describe, it, expect } from "vitest";
import { fuzzyScore, normalizeText } from "./fuzzy";

describe("normalizeText", () => {
  it("ё→е, нижний регистр, схлопывает пробелы и пунктуацию", () => {
    expect(normalizeText("Цемент  М500, ёлка!")).toBe("цемент м500 елка");
  });
});

describe("fuzzyScore", () => {
  it("идентичные строки → 1", () => {
    expect(fuzzyScore("цемент м500", "цемент м500")).toBe(1);
  });

  it("устойчив к регистру и окончаниям", () => {
    expect(fuzzyScore("Цемент М500", "цемента м500")).toBeGreaterThan(0.6);
  });

  it("разные позиции → низкий балл", () => {
    expect(fuzzyScore("цемент", "доставка самосвалом")).toBeLessThan(0.2);
  });

  it("пустые строки → 0", () => {
    expect(fuzzyScore("", "цемент")).toBe(0);
  });
});
