import { describe, it, expect } from "vitest";
import { mapCategories, serviceInHead, serviceOfCategory, subjectFor } from "./services";
import { autoSubjectFromItems } from "./pdf/subject";

describe("услуги — раздел поставщика раскладывается по понятной услуге", () => {
  it("по названию раздела", () => {
    expect(serviceOfCategory("Соединения компрессионные (IRRITEC)")?.id).toBe("irrigation");
    expect(serviceOfCategory("Светильники грунтовые")?.id).toBe("lighting");
    expect(serviceOfCategory("Монтаж свай под светильники (работы производит бригада поставщика)")?.id).toBe("lighting");
    expect(serviceOfCategory("Газон рулонный")?.id).toBe("lawn");
    expect(serviceOfCategory("Брусчатка и бордюры")?.id).toBe("paving");
  });

  it("раздел без подсказки в названии — по его позициям", () => {
    const names = ["Дождеватель Hunter PGP", "Форсунка Rain Bird 1804", "Муфта 25"];
    expect(serviceOfCategory("Комплектующие", names)?.id).toBe("irrigation");
  });

  it("общие разделы остаются без услуги", () => {
    expect(serviceOfCategory("Доставка", ["Доставка самосвалом", "Разгрузка"])).toBeNull();
    expect(serviceOfCategory("Прочее", [])).toBeNull();
  });

  it("предмет КП: одна услуга, две, много", () => {
    const m = mapCategories([
      { category: "Соединения компрессионные (IRRITEC)", name: "Муфта 25" },
      { category: "Доставка", name: "Доставка" },
    ]);
    expect(subjectFor([...m.values()])).toBe("на устройство системы автоматического полива");
  });

  it("КП по поливу больше не становится «благоустройством» (Юрий 30.10)", () => {
    const items = [
      { category: "Соединения компрессионные (IRRITEC)", name: "Муфта компрессионная 25" },
      { category: "Дождеватели (HUNTER)", name: "Дождеватель PGP" },
      { category: "Работы", name: "Монтаж узла" },
    ];
    expect(autoSubjectFromItems(items)).toBe("на устройство системы автоматического полива");
  });

  it("услуга, названная в начале диктовки", () => {
    expect(serviceInHead("КП по автополиву, десять дождевателей")?.id).toBe("irrigation");
    expect(serviceInHead("смета на освещение: пять светильников")?.id).toBe("lighting");
    expect(serviceInHead("десять дождевателей и смета на полив потом")).toBeNull();
  });
});
