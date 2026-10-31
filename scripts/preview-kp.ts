// Пример КП в PDF без базы — посмотреть вёрстку глазами: npx tsx scripts/preview-kp.ts <out.pdf>
import { writeFileSync } from "node:fs";
import { groupByCategory } from "@/lib/estimate/service";
import { estimateHtml } from "@/lib/pdf/template";
import { renderPdf } from "@/lib/pdf/render";
import { sectionsByService } from "@/lib/pdf/by-service";
import { autoSubjectFromItems } from "@/lib/pdf/subject";
import { cleanLabel } from "@/lib/ai/prompt";

const items = [
  ["Дождеватели (HUNTER)", "Дождеватель роторный Hunter PGP", 6, 1850],
  ["Соединения компрессионные (IRRITEC)", "Муфта компрессионная 25", 10, 120],
  ["Светильники грунтовые", "Светильник SWG DL-2070", 4, 6900],
  ["Газон рулонный", "Газон рулонный", 120, 290],
  ["Работы", "Монтаж дождевателя", 6, 900],
  ["Работы", "Монтаж светильника", 4, 3500],
  ["Работы", "Укладка рулонного газона", 120, 150],
  ["Доставка", "Доставка материалов", 1, 4000],
].map(([category, name, qty, price]) => ({ category: String(category), name: String(name), qty: Number(qty), unit: "шт", price: Number(price), sum: Number(qty) * Number(price), article: null }));

const groups = groupByCategory(items);
const html = estimateHtml({
  number: "A1B2C3",
  date: new Date().toLocaleDateString("ru-RU"),
  title: "Пример",
  objectName: cleanLabel("деревня дятловка. участок 472", "object"),
  clientName: cleanLabel("иван петров", "client"),
  subject: autoSubjectFromItems(items),
  groups,
  byService: sectionsByService(groups),
  total: items.reduce((a, i) => a + i.sum, 0),
  company: { name: "IQ полив", logoUrl: "", contacts: "", contactLines: ["IQ полив"], requisites: [], stampUrl: "", signatureUrl: "", signer: "" } as never,
});
writeFileSync((process.argv[2] ?? "preview-kp.pdf").replace(/.pdf$/, ".html"), html);
renderPdf(html).then((pdf) => {
  writeFileSync(process.argv[2] ?? "preview-kp.pdf", pdf);
  console.log("ok");
});
