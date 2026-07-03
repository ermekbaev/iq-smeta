// HTML-шаблон фирменной сметы (PLAN 3.5). Рендерится в PDF через Puppeteer.
// Реквизиты/логотип заказчика подставляются из COMPANY (заглушка под этап настройки).

import { EstimateGroup } from "@/lib/estimate/service";

export interface EstimatePdfData {
  number: string;
  date: string;
  title: string;
  clientName?: string | null;
  groups: EstimateGroup[];
  total: number;
}

// Реквизиты заказчика — из env (PLAN 7). Логотип: URL или data:URI в COMPANY_LOGO_URL.
const COMPANY = {
  name: process.env.COMPANY_NAME || "IQ SMETA",
  contacts:
    process.env.COMPANY_CONTACTS ||
    "тел. — · email — · ИНН —",
  logoUrl: process.env.COMPANY_LOGO_URL || "",
};

const money = (n: number) =>
  n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

const COLS = 7; // №, Артикул, Наименование, Ед., Кол-во, Цена, Сумма

export function estimateHtml(d: EstimatePdfData): string {
  let rowNum = 0; // сквозная нумерация по всему документу
  const rows = d.groups
    .map((g) => {
      const lines = g.lines
        .map(
          (l) => `
        <tr>
          <td class="num">${++rowNum}</td>
          <td class="art">${esc(l.article ?? "")}</td>
          <td>${esc(l.name)}</td>
          <td class="c">${esc(l.unit)}</td>
          <td class="r">${money(l.qty)}</td>
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

  // раздельные итоги: оборудование/материалы и работы (как в смете заказчика)
  const equip = d.groups.filter((g) => !g.isWork).reduce((s, g) => s + g.subtotal, 0);
  const works = d.groups.filter((g) => g.isWork).reduce((s, g) => s + g.subtotal, 0);

  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  body { font-family: 'DejaVu Sans', Arial, sans-serif; color: #111; font-size: 11px; margin: 28px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 16px; }
  .brandbox { display: flex; align-items: center; gap: 12px; }
  .logo { height: 48px; width: auto; object-fit: contain; }
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
</style></head><body>
  <div class="head">
    <div class="brandbox">
      ${COMPANY.logoUrl ? `<img class="logo" src="${esc(COMPANY.logoUrl)}" alt="">` : ""}
      <div>
        <div class="brand">${esc(COMPANY.name)}</div>
        <div class="contacts">${esc(COMPANY.contacts)}</div>
      </div>
    </div>
    <div class="meta">Смета № ${esc(d.number)}<br>от ${esc(d.date)}</div>
  </div>

  <h1>${esc(d.title)}</h1>
  ${d.clientName ? `<div class="client">Заказчик: ${esc(d.clientName)}</div>` : ""}

  <table>
    <thead><tr>
      <th class="num">№</th><th>Артикул</th><th>Наименование</th><th>Ед.</th>
      <th class="r">Кол-во</th><th class="r">Цена</th><th class="r">Сумма</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    ${equip > 0 ? `<div class="row"><span>Оборудование и материалы</span><b>${money(equip)} ₽</b></div>` : ""}
    ${works > 0 ? `<div class="row"><span>Работы</span><b>${money(works)} ₽</b></div>` : ""}
    <div class="row grand"><span>ИТОГО</span><span>${money(d.total)} ₽</span></div>
  </div>
</body></html>`;
}
