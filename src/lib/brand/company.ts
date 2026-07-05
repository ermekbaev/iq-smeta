// Реквизиты ИП заказчика для КП — ЗАШИТЫ здесь (один бренд, как в metalcrm).
// Мультибренд (сборники со своими реквизитами/лого) — следующая фаза.
//
// Картинки (логотип, печать, подпись) кладутся файлами в ./assets и читаются
// в data URL (Puppeteer не резолвит относительные пути). Замени плейсхолдеры
// ниже на настоящие данные из Excel заказчика.

import fs from "node:fs";
import path from "node:path";

const ASSET_DIR = path.join(process.cwd(), "src", "lib", "brand", "assets");

/** Читает картинку бренда → data URL. Нет файла — пустая строка (в PDF просто не покажется). */
function assetDataUrl(file: string): string {
  try {
    const buf = fs.readFileSync(path.join(ASSET_DIR, file));
    const ext = path.extname(file).slice(1).toLowerCase();
    const mime =
      ext === "svg" ? "image/svg+xml" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return "";
  }
}

export interface CompanyBrand {
  /** Название бренда/ИП в шапке. */
  name: string;
  /** Дефолтный логотип (если у сметы нет своего загруженного). */
  logoUrl: string;
  /** Строка контактов под названием (сайт/телефон). */
  contacts: string;
  /** Строки реквизитов для подвала КП. */
  requisites: string[];
  /** Печать (data URL). */
  stampUrl: string;
  /** Подпись (data URL). */
  signatureUrl: string;
  /** Кто подписывает — под подписью (напр. «ИП Мохов Ю. А.»). */
  signer: string;
}

// TODO(заказчик): подставить настоящие значения из Excel (ИП, ИНН, ОГРНИП, адрес, банк).
// Файлы положить: assets/logo.png, assets/stamp.png, assets/signature.png (PNG с прозрачным фоном).
export const COMPANY: CompanyBrand = {
  name: process.env.COMPANY_NAME || "IQ Полив",
  logoUrl: assetDataUrl("logo.png"),
  contacts: process.env.COMPANY_CONTACTS || "iqpoliv.ru",
  requisites: [
    "ИП — (наименование)",
    "ИНН — · ОГРНИП —",
    "Адрес: —",
    "Р/с — · Банк — · БИК —",
  ],
  stampUrl: assetDataUrl("stamp.png"),
  signatureUrl: assetDataUrl("signature.png"),
  signer: "ИП —",
};
