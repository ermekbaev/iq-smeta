import { describe, it, expect } from "vitest";
import { parseExtraction } from "./prompt";

describe("parseExtraction", () => {
  it("парсит чистый JSON-массив", () => {
    const r = parseExtraction('[{"name":"цемент","qty":10,"unit":"мешок"}]');
    expect(r).toEqual([{ name: "цемент", qty: 10, unit: "шт" }]);
  });

  it("снимает markdown-обёртку ```json", () => {
    const r = parseExtraction('```json\n[{"name":"песок","qty":3,"unit":"куб"}]\n```');
    expect(r).toEqual([{ name: "песок", qty: 3, unit: "м3" }]);
  });

  it("вырезает массив из текста вокруг", () => {
    const r = parseExtraction('Вот позиции: [{"name":"щебень","qty":1,"unit":"т"}] — всё.');
    expect(r[0].name).toBe("щебень");
    expect(r[0].unit).toBe("т");
  });

  it("qty по умолчанию 1, мусорное qty чинится", () => {
    const r = parseExtraction('[{"name":"доставка","unit":"шт"},{"name":"x","qty":-5,"unit":"шт"}]');
    expect(r[0].qty).toBe(1);
    expect(r[1].qty).toBe(1);
  });

  it("отбрасывает позиции без имени", () => {
    const r = parseExtraction('[{"name":"","qty":2,"unit":"шт"},{"name":"кирпич","qty":2,"unit":"шт"}]');
    expect(r).toHaveLength(1);
    expect(r[0].name).toBe("кирпич");
  });

  it("невалидный ввод → пустой массив", () => {
    expect(parseExtraction("извините, не понял")).toEqual([]);
    expect(parseExtraction("")).toEqual([]);
  });
});
