// Рендер HTML → PDF через Puppeteer (PLAN 3.5).
// Замечание по проду (PLAN 8): Puppeteer тянет Chromium и требует памяти —
// на минимальном хостинге заложить RAM или перейти на @react-pdf.

import puppeteer from "puppeteer";

export async function renderPdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
