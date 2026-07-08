import { describe, it, expect } from "vitest";
import { parseExtraction } from "./prompt";

describe("parseExtraction", () => {
  it("парсит объект {client, items}", () => {
    const r = parseExtraction(
      '{"client":"ИП Адилет","items":[{"name":"цемент","qty":10,"unit":"мешок"}]}'
    );
    expect(r).toEqual({
      client: "ИП Адилет",
      items: [{ name: "цемент", qty: 10, unit: "шт" }],
    });
  });

  it("client=null, когда заказчик не назван", () => {
    const r = parseExtraction('{"client":null,"items":[{"name":"песок","qty":3,"unit":"куб"}]}');
    expect(r.client).toBeNull();
    expect(r.items).toEqual([{ name: "песок", qty: 3, unit: "м3" }]);
  });

  it("голый массив (старый формат) → client null", () => {
    const r = parseExtraction('[{"name":"цемент","qty":10,"unit":"мешок"}]');
    expect(r).toEqual({ client: null, items: [{ name: "цемент", qty: 10, unit: "шт" }] });
  });

  it("снимает markdown-обёртку ```json", () => {
    const r = parseExtraction(
      '```json\n{"client":null,"items":[{"name":"песок","qty":3,"unit":"куб"}]}\n```'
    );
    expect(r.items).toEqual([{ name: "песок", qty: 3, unit: "м3" }]);
  });

  it("вырезает JSON из текста вокруг", () => {
    const r = parseExtraction(
      'Вот: {"client":null,"items":[{"name":"щебень","qty":1,"unit":"т"}]} — всё.'
    );
    expect(r.items[0].name).toBe("щебень");
    expect(r.items[0].unit).toBe("т");
  });

  it("qty по умолчанию 1, мусорное qty чинится", () => {
    const r = parseExtraction(
      '{"items":[{"name":"доставка","unit":"шт"},{"name":"x","qty":-5,"unit":"шт"}]}'
    );
    expect(r.items[0].qty).toBe(1);
    expect(r.items[1].qty).toBe(1);
  });

  it("отбрасывает позиции без имени", () => {
    const r = parseExtraction(
      '{"items":[{"name":"","qty":2,"unit":"шт"},{"name":"кирпич","qty":2,"unit":"шт"}]}'
    );
    expect(r.items).toHaveLength(1);
    expect(r.items[0].name).toBe("кирпич");
  });

  it('мусорный client ("null"/пустой) → null', () => {
    expect(parseExtraction('{"client":"null","items":[]}').client).toBeNull();
    expect(parseExtraction('{"client":"  ","items":[]}').client).toBeNull();
  });

  it("невалидный ввод → пустой результат", () => {
    expect(parseExtraction("извините, не понял")).toEqual({ client: null, items: [] });
    expect(parseExtraction("")).toEqual({ client: null, items: [] });
  });

  it("произнесённая цена подхватывается, null/мусор — игнорируется", () => {
    const r = parseExtraction(
      '{"items":[{"name":"нестандартные работы","qty":1,"unit":"шт","price":20000},' +
        '{"name":"форсунка","qty":10,"unit":"шт","price":null},' +
        '{"name":"песок","qty":3,"unit":"куб","price":-5}]}'
    );
    expect(r.items[0]).toEqual({ name: "нестандартные работы", qty: 1, unit: "шт", price: 20000 });
    expect(r.items[1]).toEqual({ name: "форсунка", qty: 10, unit: "шт" }); // price null → нет поля
    expect(r.items[2]).toEqual({ name: "песок", qty: 3, unit: "м3" }); // price<0 → игнор
  });
});
