// HTML-шаблон фирменной сметы / КП (PLAN 3.5). Рендерится в PDF через Puppeteer.
// Логотип — на уровне сметы (загружается при создании КП). Реквизиты/печать/подпись/
// дефолтное лого — из настроек компании (CompanySettings в БД), передаются в d.company.

import { EstimateGroup } from "@/lib/estimate/service";
import { CompanyBrand } from "@/lib/brand/company";

export interface EstimatePdfData {
  number: string;
  date: string;
  title: string;
  /** Объект/название — строка «Объект —». */
  objectName?: string | null;
  /** Предмет КП — идёт после слов «Коммерческое предложение». */
  subject?: string | null;
  /** Заказчик — строка «Заказчик:». */
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

// Первая буква — заглавная (остальное не трогаем).
function cap(s: string): string {
  const t = s.trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

// Полностью в верхний регистр (название объекта в КП).
function upper(s: string): string {
  return s.trim().toUpperCase();
}

export function estimateHtml(d: EstimatePdfData): string {
  const renderLines = (lines: EstimateGroup["lines"]) =>
    lines
      .map(
        (l) => `
        <tr>
          <td>${esc(cap(l.name))}</td>
          <td class="c">${money(l.qty)}</td>
          <td class="c">${esc(l.unit)}</td>
          <td class="r">${money(l.price)}</td>
          <td class="r">${money(l.sum)}</td>
        </tr>`
      )
      .join("");

  // Блок «Оборудование/материалы» или «Работы»: разделы-заголовки + позиции,
  // и ОДИН именной итог на весь блок (без подытогов по каждому разделу).
  const section = (groups: EstimateGroup[], totalLabel: string, sum: number) =>
    groups.length
      ? groups
          .map(
            (g) => `
      <tr class="group"><td colspan="5">${esc(cap(g.label))}</td></tr>
      ${renderLines(g.lines)}`
          )
          .join("") +
        `
      <tr class="subtotal"><td class="r" colspan="4">${totalLabel}</td><td class="r">${money(sum)} ₽</td></tr>`
      : "";

  const equipGroups = d.groups.filter((g) => !g.isWork);
  const workGroups = d.groups.filter((g) => g.isWork);
  const equipmentSum = equipGroups.reduce((s, g) => s + g.subtotal, 0);
  const worksSum = workGroups.reduce((s, g) => s + g.subtotal, 0);

  const rows =
    section(equipGroups, "Итого за оборудование и материалы", equipmentSum) +
    section(workGroups, "Итого за работы", worksSum);

  // Заголовок КП: «Коммерческое предложение» + предмет («по организации системы …»).
  // Если предмет уже начинается с этих слов — не дублируем.
  const subj = (d.subject ?? "").trim();
  const heading = !subj
    ? "Коммерческое предложение"
    : /^коммерческое предложение/i.test(subj)
      ? cap(subj)
      : `Коммерческое предложение ${subj}`;

  const c = d.company;
  const logo = imgSrc(d.logo) || imgSrc(c.logoUrl);
  const stamp = imgSrc(c.stampUrl);
  const signature = imgSrc(c.signatureUrl);
  const contactLines = (c.contactLines.length ? c.contactLines : [c.name, c.contacts])
    .filter(Boolean)
    .map((l) => esc(l))
    .join("<br>");

  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  body { font-family: 'DejaVu Sans', Arial, sans-serif; color: #111; font-size: 12px; margin: 28px; background: #fff; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 22px; }
  .logo { height: 60px; width: auto; max-width: 240px; object-fit: contain; }
  .brand { font-size: 22px; font-weight: 700; }
  .contacts { text-align: right; font-size: 12px; line-height: 1.5; color: #222; }
  h1 { font-size: 15px; font-weight: 700; text-align: center; margin: 0 0 6px; }
  .object { text-align: center; font-size: 13px; margin: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #000; padding: 6px 8px; vertical-align: top; }
  th { background: #fff; text-align: center; font-weight: 700; }
  th.name { text-align: left; }
  td.c { text-align: center; white-space: nowrap; }
  td.r, th.r { text-align: right; white-space: nowrap; }
  tr.group td { background: #eef2ff; font-weight: 700; }
  tr.subtotal td { background: #fafafa; font-weight: 600; }
  tr.total td { font-weight: 700; }
  tr.total td.lbl { text-align: right; }
  tr.grand td { font-size: 14px; background: #eef2ff; }
  .sign { position: relative; margin-top: 64px; font-size: 13px; min-height: 130px; }
  .sign .line { display: inline-block; position: relative; }
  .sign .sig { position: absolute; left: -6px; bottom: 8px; height: 60px; width: auto; object-fit: contain; }
  .sign .stamp { position: absolute; left: 235px; bottom: -78px; height: 125px; width: 125px; object-fit: contain; opacity: .92; }
</style></head><body>
  <div class="head">
    <div>
      ${logo ? `<img class="logo" src="${logo}" alt="">` : `<div class="brand">${esc(c.name)}</div>`}
    </div>
    <div class="contacts">${contactLines}</div>
  </div>

  <h1>${esc(heading)}</h1>
  ${d.objectName ? `<div class="object">по объекту: <b>${esc(upper(d.objectName))}</b></div>` : ""}
  ${d.clientName ? `<div class="object">для: ${esc(cap(d.clientName))}</div>` : ""}

  <table>
    <thead><tr>
      <th class="name">Наименование</th>
      <th>Кол-во</th><th>Ед.изм.</th><th>Цена</th><th>Сумма</th>
    </tr></thead>
    <tbody>
      ${rows}
      <tr class="total grand"><td class="lbl" colspan="4">Общая стоимость под ключ:</td><td class="r">${money(d.total)} ₽</td></tr>
    </tbody>
  </table>

  <div class="sign">
    <span class="line">
      ${signature ? `<img class="sig" src="${signature}" alt="">` : ""}
      ______________&nbsp;&nbsp;/&nbsp;&nbsp;${esc(c.signer)}
      ${stamp ? `<img class="stamp" src="${stamp}" alt="">` : ""}
    </span>
  </div>
</body></html>`;
}
