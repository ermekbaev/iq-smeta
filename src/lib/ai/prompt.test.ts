import { describe, it, expect } from "vitest";
import { cleanLabel, parseExtraction } from "./prompt";

describe("cleanLabel — служебные слова не должны попадать в значение", () => {
  it("снимает ярлык объекта/заказчика", () => {
    expect(cleanLabel("Объект Павлово 15")).toBe("Павлово 15");
    expect(cleanLabel("заказчик василий")).toBe("Василий");
    expect(cleanLabel("Заказчик: ООО Ромашка")).toBe("ООО Ромашка");
    expect(cleanLabel("для ИП Адилет")).toBe("ИП Адилет");
    expect(cleanLabel("смета Павлово 2")).toBe("Павлово 2");
  });

  it("снимает предлог после ярлыка и несколько ярлыков подряд", () => {
    expect(cleanLabel("объект на Павлово")).toBe("Павлово");
    expect(cleanLabel("для заказчика Иван")).toBe("Иван");
  });

  it("поднимает первую букву (модель отдаёт с маленькой)", () => {
    expect(cleanLabel("василий")).toBe("Василий");
    expect(cleanLabel("павлово 15")).toBe("Павлово 15");
  });

  it("обычное название не калечит", () => {
    expect(cleanLabel("Павлово 15")).toBe("Павлово 15");
    expect(cleanLabel("ЖК в Кунцево")).toBe("ЖК в Кунцево");
    // слово, лишь начинающееся как ярлык, — не ярлык (нет разделителя)
    expect(cleanLabel("Сметана 5")).toBe("Сметана 5");
  });

  it("заглавные буквы по правилам (Юрий 30.10)", () => {
    expect(cleanLabel("деревня дятловка. земельный участок 472", "object")).toBe("Деревня Дятловка. Земельный участок 472");
    expect(cleanLabel("жк солнечный", "object")).toBe("ЖК Солнечный");
    expect(cleanLabel("кп никольские озера", "object")).toBe("КП Никольские озера");
    expect(cleanLabel("иван петров", "client")).toBe("Иван Петров");
    expect(cleanLabel("ип мохов юрий", "client")).toBe("ИП Мохов Юрий");
    expect(cleanLabel("ооо зелёный сад", "client")).toBe("ООО Зелёный сад");
  });

  it("мусор → null", () => {
    expect(cleanLabel("null")).toBeNull();
    expect(cleanLabel("")).toBeNull();
    expect(cleanLabel(undefined)).toBeNull();
    expect(cleanLabel("объект")).toBeNull(); // только ярлык, значения нет
  });
});

describe("parseExtraction", () => {
  it("парсит объект {object, client, items}", () => {
    const r = parseExtraction(
      '{"object":"Павлово 2","client":"ИП Адилет","items":[{"name":"цемент","qty":10,"unit":"мешок"}]}'
    );
    expect(r).toEqual({
      object: "Павлово 2",
      client: "ИП Адилет",
      items: [{ name: "цемент", qty: 10, unit: "шт" }],
    });
  });

  it("object/client=null, когда не названы", () => {
    const r = parseExtraction('{"client":null,"items":[{"name":"песок","qty":3,"unit":"куб"}]}');
    expect(r.object).toBeNull();
    expect(r.client).toBeNull();
    expect(r.items).toEqual([{ name: "песок", qty: 3, unit: "м3" }]);
  });

  it("голый массив (старый формат) → object/client null", () => {
    const r = parseExtraction('[{"name":"цемент","qty":10,"unit":"мешок"}]');
    expect(r).toEqual({
      object: null,
      client: null,
      items: [{ name: "цемент", qty: 10, unit: "шт" }],
    });
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

  it("ярлыки из ответа модели вычищаются (баг с «Заказчик василий»)", () => {
    const r = parseExtraction(
      '{"object":"Объект Павлова 15","client":"Заказчик василий","items":[{"name":"труба","qty":2,"unit":"м"}]}'
    );
    expect(r.object).toBe("Павлова 15");
    expect(r.client).toBe("Василий");
  });

  it("невалидный ввод → пустой результат", () => {
    expect(parseExtraction("извините, не понял")).toEqual({ object: null, client: null, items: [] });
    expect(parseExtraction("")).toEqual({ object: null, client: null, items: [] });
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
