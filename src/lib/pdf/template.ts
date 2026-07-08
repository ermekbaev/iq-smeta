// HTML-шаблон фирменной сметы / КП (PLAN 3.5). Рендерится в PDF через Puppeteer.
// Логотип — на уровне сметы (загружается при создании КП). Реквизиты/печать/подпись/
// дефолтное лого — из настроек компании (CompanySettings в БД), передаются в d.company.

import { EstimateGroup } from "@/lib/estimate/service";
import { CompanyBrand } from "@/lib/brand/company";

export interface EstimatePdfData {
  number: string;
  date: string;
  title: string;
  clientName?: string | null;
  groups: EstimateGroup[];
  total: number;
  /** Логотип КП (data URL) — если у сметы свой; иначе берётся дефолтный из настроек. */
  logo?: string | null;
  /** Реквизиты/лого/печать компании из настроек. */
  company: CompanyBrand;
}

const money = (n: number) =>
  n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

/** Безопасный src для картинок: только data: / http(s). */
function imgSrc(src: string | null | undefined): string {
  return src && /^(data:|https?:)/.test(src) ? src : "";
}

const COLS = 5; // Наименование, Кол-во, Ед.изм., Цена, Сумма (по шаблону заказчика)

export function estimateHtml(d: EstimatePdfData): string {
  const rows = d.groups
    .map((g) => {
      const lines = g.lines
        .map(
          (l) => `
        <tr>
          <td>${esc(l.name)}</td>
          <td class="r">${money(l.qty)}</td>
          <td class="c">${esc(l.unit)}</td>
          <td class="r">${money(l.price)}</td>
          <td class="r">${money(l.sum)}</td>
        </tr>`
        )
        .join("");
      return `
      <tr class="group"><td colspan="${COLS}">${esc(g.label)}</td></tr>
      ${lines}
      <tr class="subtotal"><td colspan="${COLS - 1}" class="r">Итого по разделу</td><td class="r">${money(g.subtotal)}</td></tr>`;
    })
    .join("");

  // общая стоимость работ (без НДС) — по шаблону заказчика
  const works = d.groups.filter((g) => g.isWork).reduce((s, g) => s + g.subtotal, 0);

  const c = d.company;
  const logo = imgSrc(d.logo) || imgSrc(c.logoUrl);
  const stamp = imgSrc(c.stampUrl);
  const signature = imgSrc(c.signatureUrl);
  const requisites = c.requisites.map((r) => esc(r)).join("<br>");

  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  body { font-family: 'DejaVu Sans', Arial, sans-serif; color: #111; font-size: 11px; margin: 28px; background: #fff; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 16px; }
  .brandbox { display: flex; align-items: center; gap: 12px; }
  .logo { height: 46px; width: auto; max-width: 210px; object-fit: contain; }
  .brand { font-size: 20px; font-weight: 700; }
  .contacts { color: #555; font-size: 11px; margin-top: 4px; }
  .meta { text-align: right; font-size: 11px; color: #333; }
  h1 { font-size: 15px; margin: 0 0 4px; }
  .client { margin-bottom: 12px; color: #333; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ccc; padding: 5px 7px; vertical-align: top; }
  th { background: #f3f3f3; text-align: left; font-weight: 600; }
  td.num, td.c { text-align: center; }
  td.art { color: #555; white-space: nowrap; font-size: 10px; }
  td.r, th.r { text-align: right; white-space: nowrap; }
  tr.group td { background: #eef2ff; font-weight: 700; }
  tr.subtotal td { background: #fafafa; font-weight: 600; }
  .totals { margin-top: 16px; margin-left: auto; width: 320px; }
  .totals .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
  .totals .grand { border-top: 2px solid #111; margin-top: 4px; padding-top: 8px; font-size: 15px; font-weight: 700; }
  .footer { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; margin-top: 28px; padding-top: 12px; border-top: 1px solid #ccc; }
  .req { color: #555; font-size: 10px; line-height: 1.5; }
  .sign { text-align: center; position: relative; min-width: 200px; }
  .sign .imgs { position: relative; height: 90px; }
  .sign .stamp { position: absolute; right: 0; bottom: 0; height: 90px; width: 90px; object-fit: contain; opacity: .95; }
  .sign .sig { position: absolute; left: 20px; bottom: 20px; height: 46px; width: auto; object-fit: contain; }
  .sign .line { border-top: 1px solid #111; padding-top: 4px; font-size: 11px; }
</style></head><body>
  <div class="head">
    <div class="brandbox">
      ${logo ? `<img class="logo" src="${logo}" alt="">` : ""}
      <div>
        <div class="brand">${esc(c.name)}</div>
        <div class="contacts">${esc(c.contacts)}</div>
      </div>
    </div>
    <div class="meta">Смета № ${esc(d.number)}<br>от ${esc(d.date)}</div>
  </div>

  <h1>${esc(d.title)}</h1>
  ${d.clientName ? `<div class="client">Заказчик: ${esc(d.clientName)}</div>` : ""}

  <table>
    <thead><tr>
      <th>Наименование</th>
      <th class="r">Кол-во</th><th class="c">Ед.изм.</th><th class="r">Цена</th><th class="r">Сумма</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div class="row grand"><span>Итого без НДС</span><span>${money(d.total)} ₽</span></div>
    ${works > 0 ? `<div class="row"><span>Общая стоимость работ (без НДС)</span><b>${money(works)} ₽</b></div>` : ""}
  </div>

  <div class="footer">
    <div class="req">${requisites}</div>
    <div class="sign">
      <div class="imgs">
        ${signature ? `<img class="sig" src="${signature}" alt="">` : ""}
        ${stamp ? `<img class="stamp" src="${stamp}" alt="">` : ""}
      </div>
      <div class="line">${esc(c.signer)}</div>
    </div>
  </div>
</body></html>`;
}
