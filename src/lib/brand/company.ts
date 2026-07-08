// Реквизиты компании/ИП для КП. Хранятся в БД (CompanySettings, синглтон),
// редактируются на странице «Настройки компании» — как в metalcrm.
// Мультибренд (сборники со своими реквизитами/лого) — следующая фаза.

import { prisma } from "@/lib/prisma";

export const SETTINGS_ID = "singleton";

export interface CompanyBrand {
  /** Название бренда/ИП в шапке. */
  name: string;
  /** Дефолтный логотип (если у сметы нет своего загруженного). */
  logoUrl: string;
  /** Строка контактов под названием (сайт/телефон/email). */
  contacts: string;
  /** Контакты для шапки КП построчно, справа (название/адрес/e-mail/телефон/сайт). */
  contactLines: string[];
  /** Строки реквизитов для подвала КП. */
  requisites: string[];
  /** Печать (data URL). */
  stampUrl: string;
  /** Подпись (data URL). */
  signatureUrl: string;
  /** Кто подписывает — под подписью. */
  signer: string;
}

/** Настройки компании из БД (или пустой синглтон). */
export async function getCompanySettings() {
  const s = await prisma.companySettings.findUnique({ where: { id: SETTINGS_ID } });
  return s;
}

/** Собирает бренд для PDF/КП из настроек компании. */
export async function getCompanyBrand(): Promise<CompanyBrand> {
  const s = await getCompanySettings();

  const contacts = [s?.phone, s?.website, s?.email].filter(Boolean).join(" · ");

  // Шапка КП (справа), как в образце заказчика: название/адрес/e-mail/тел/сайт.
  const contactLines = [
    s?.name,
    s?.address,
    s?.email ? `e-mail: ${s.email}` : "",
    s?.phone,
    s?.website,
  ].filter(Boolean) as string[];

  const requisites: string[] = [];
  if (s?.name) requisites.push(s.name);
  const idLine = [s?.inn ? `ИНН ${s.inn}` : "", s?.ogrn ? `ОГРНИП ${s.ogrn}` : ""]
    .filter(Boolean)
    .join(" · ");
  if (idLine) requisites.push(idLine);
  if (s?.address) requisites.push(`Адрес: ${s.address}`);
  const bank = [
    s?.bankName ? `Банк: ${s.bankName}` : "",
    s?.bankAccount ? `Р/с ${s.bankAccount}` : "",
    s?.bankBik ? `БИК ${s.bankBik}` : "",
    s?.bankCorAccount ? `К/с ${s.bankCorAccount}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  if (bank) requisites.push(bank);

  return {
    name: s?.name || "IQ SMETA",
    logoUrl: s?.logo || "",
    contacts,
    contactLines,
    requisites,
    stampUrl: s?.stamp || "",
    signatureUrl: s?.signature || "",
    signer: s?.signer || s?.name || "",
  };
}
