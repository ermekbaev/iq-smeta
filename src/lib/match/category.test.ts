import { describe, it, expect } from "vitest";
import { detectCategoryCommand, matchCategory } from "./category";

const CATS = ["Дренаж", "Благоустройство", "Освещение", "Газон", "Мощение"];

describe("matchCategory — произнесённое слово → категория прайса", () => {
  it("точное совпадение и падежи", () => {
    expect(matchCategory("дренаж", CATS)).toBe("Дренаж");
    expect(matchCategory("из дренажа", CATS)).toBe("Дренаж");
    expect(matchCategory("по благоустройству", CATS)).toBe("Благоустройство");
    expect(matchCategory("из освещения", CATS)).toBe("Освещение");
  });

  it("служебные слова не мешают", () => {
    expect(matchCategory("бери из категории газон", CATS)).toBe("Газон");
    expect(matchCategory("раздел мощение", CATS)).toBe("Мощение");
  });

  it("категория из двух слов", () => {
    expect(matchCategory("из наружного освещения", ["Наружное освещение", "Газон"])).toBe(
      "Наружное освещение"
    );
  });

  it("длинная категория не проигрывает короткой, входящей в неё частью", () => {
    const cats = ["12 Вольт", "LED лампы A-MR16 - 12 Вольт", "RGB"];
    expect(matchCategory("led лампы a-mr16 - 12 вольт", cats)).toBe(
      "LED лампы A-MR16 - 12 Вольт"
    );
    // короткую по-прежнему находим, когда её и назвали
    expect(matchCategory("12 вольт", cats)).toBe("12 Вольт");
  });

  it("незнакомое слово → null", () => {
    expect(matchCategory("из подсветки фасада", CATS)).toBeNull();
    expect(matchCategory("", CATS)).toBeNull();
    expect(matchCategory("дренаж", [])).toBeNull();
  });
});

describe("detectCategoryCommand — команда в начале диктовки", () => {
  it("срезает команду и возвращает категорию", () => {
    expect(detectCategoryCommand("Бери из дренажа: 10 труб, 5 колодцев", CATS)).toEqual({
      category: "Дренаж",
      text: "10 труб, 5 колодцев",
    });
    expect(detectCategoryCommand("возьми по благоустройству, 20 метров бордюра", CATS)).toEqual(
      { category: "Благоустройство", text: "20 метров бордюра" }
    );
  });

  it("без запятой позиции не теряются — срезаем только слова команды", () => {
    expect(detectCategoryCommand("бери из дренажа 10 труб", CATS)).toEqual({
      category: "Дренаж",
      text: "10 труб",
    });
  });

  it("число позиции не съедается, даже если совпало с числом в названии", () => {
    const cats = ["12 Вольт"];
    expect(detectCategoryCommand("бери из 12 вольт 12 метров кабеля", cats)).toEqual({
      category: "12 Вольт",
      text: "12 метров кабеля",
    });
  });

  it("без команды текст не трогаем", () => {
    const t = "10 мешков цемента, 3 куба песка";
    expect(detectCategoryCommand(t, CATS)).toEqual({ category: null, text: t });
  });

  it("«из» внутри позиции не считается командой (ищем только в начале)", () => {
    const t = "10 метров трубы, 5 колодцев из дренажа";
    expect(detectCategoryCommand(t, CATS)).toEqual({ category: null, text: t });
  });

  // ложное срабатывание опаснее нераспознавания: молча сузило бы всю смету
  it("команда обязана быть первым словом — предлог внутри позиции не считается", () => {
    const cats = ["Трубы ПНД", "Доставка", "Дренаж"];
    for (const t of [
      "20 метров трубы из ПНД, 5 колодцев",
      "доставка самосвалом по объекту",
      "10 мешков цемента, 3 куба песка",
    ]) {
      expect(detectCategoryCommand(t, cats)).toEqual({ category: null, text: t });
    }
  });

  it("триггер есть, но категория незнакомая → не трогаем", () => {
    const t = "бери из подсветки фасада, 10 гирлянд";
    expect(detectCategoryCommand(t, CATS)).toEqual({ category: null, text: t });
  });

  it("только команда без позиций → пустой текст", () => {
    expect(detectCategoryCommand("бери из дренажа", CATS)).toEqual({
      category: "Дренаж",
      text: "",
    });
  });

  it("пустой ввод / нет категорий", () => {
    expect(detectCategoryCommand("", CATS)).toEqual({ category: null, text: "" });
    expect(detectCategoryCommand("бери из дренажа", [])).toEqual({
      category: null,
      text: "бери из дренажа",
    });
  });
});
