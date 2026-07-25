import { describe, it, expect } from "vitest";
import { estimateHtml, EstimatePdfData } from "./template";
import { CompanyBrand } from "@/lib/brand/company";

const emptyBrand: CompanyBrand = {
  name: "IQ SMETA",
  logoUrl: "",
  contacts: "",
  contactLines: [],
  requisites: [],
  stampUrl: "",
  signatureUrl: "",
  signer: "",
};

const base: Omit<EstimatePdfData, "company"> = {
  number: "1",
  date: "19.07.2026",
  title: "Смета",
  groups: [
    {
      category: "Материалы",
      label: "Материалы",
      isWork: false,
      subtotal: 1000,
      lines: [{ article: null, name: "Труба ПНД", qty: 10, unit: "м", price: 100, sum: 1000 }],
    },
  ],
  total: 1000,
};

describe("estimateHtml — устойчивость к пустым реквизитам (аккаунт без печати/подписи)", () => {
  it("минимальный аккаунт: нет висячего «/ имя», нет тега печати/подписи", () => {
    const html = estimateHtml({ ...base, company: emptyBrand });
    expect(html).toContain("Труба ПНД");
    expect(html).toContain("Общая стоимость под ключ");
    // подписанта нет → нет разделителя «/»
    expect(html).not.toContain("&nbsp;&nbsp;/&nbsp;&nbsp;");
    // печати/подписи нет → нет их картинок
    expect(html).not.toContain('class="stamp"');
    expect(html).not.toContain('class="sig"');
    // логотипа нет → в шапке текстовый бренд
    expect(html).toContain('class="brand"');
  });

  it("нет объекта/заказчика/предмета → эти строки просто отсутствуют", () => {
    const html = estimateHtml({ ...base, company: emptyBrand });
    expect(html).not.toContain("по объекту:");
    expect(html).not.toContain("для:");
    // заголовок КП всё равно есть
    expect(html).toContain("Коммерческое предложение");
  });

  it("полный аккаунт: печать, подпись и имя подписанта на месте", () => {
    const full: CompanyBrand = {
      ...emptyBrand,
      name: "ИП Иванов",
      signer: "Иванов И.И.",
      stampUrl: "data:image/png;base64,AAAA",
      signatureUrl: "data:image/png;base64,BBBB",
      logoUrl: "data:image/png;base64,CCCC",
    };
    const html = estimateHtml({
      ...base,
      objectName: "Павлово",
      clientName: "ООО Ромашка",
      company: full,
    });
    expect(html).toContain("&nbsp;&nbsp;/&nbsp;&nbsp;Иванов И.И.");
    expect(html).toContain('class="stamp"');
    expect(html).toContain('class="sig"');
    // лого в фиксированной рамке — одинаковый размер у всех компаний
    expect(html).toContain('class="logo-box"');
    expect(html).toContain('class="logo"');
  });
});

describe("estimateHtml — правки заказчика по КП", () => {
  const brand: CompanyBrand = { ...emptyBrand, name: "ЭкоГарден" };

  it("объект: только первая буква заглавная, не капс", () => {
    const html = estimateHtml({ ...base, objectName: "павлова 15", company: brand });
    expect(html).toContain("по объекту: <b>Павлова 15</b>");
    expect(html).not.toContain("ПАВЛОВА 15");
  });

  it("слово «объект» в начале названия не дублируется", () => {
    const html = estimateHtml({ ...base, objectName: "Объект Павлова 15", company: brand });
    expect(html).toContain("по объекту: <b>Павлова 15</b>");
  });

  it("формулировка КП, попавшая в поле объекта, вычищается", () => {
    const html = estimateHtml({
      ...base,
      objectName: "Коммерческое предложение на организацию системы освещения",
      company: brand,
    });
    expect(html).not.toContain("по объекту: <b>Коммерческое предложение");
    expect(html).toContain("Организацию системы освещения");
  });

  it("вместо «для:» — «Заказчик:»", () => {
    const html = estimateHtml({ ...base, clientName: "василий", company: brand });
    expect(html).toContain("Заказчик: Василий");
    expect(html).not.toContain("для: ");
  });

  it("контакты в своей рамке — длинный адрес переносится", () => {
    const html = estimateHtml({
      ...base,
      company: {
        ...brand,
        contactLines: [
          "ЭкоГарден",
          "г. Москва, БЦ «Империал Парк», ул. Вишнёвая, д.9 корп.1, офис 218",
          "+7 (495) 990-48-16",
        ],
      },
    });
    expect(html).toContain("max-width: 280px");
    expect(html).toContain("Вишнёвая");
  });
});
