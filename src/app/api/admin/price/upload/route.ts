import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { parsePriceFile } from "@/lib/price/parse";
import { importPrice } from "@/lib/price/service";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  const { userId } = gate;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const isCsv =
    file.type === "text/csv" || /\.csv$/i.test(file.name ?? "");
  const parsed = parsePriceFile(buf, { csv: isCsv });

  if (parsed.rows.length === 0) {
    return NextResponse.json(
      {
        error:
          "Не удалось разобрать прайс. Нужны колонки «наименование» и «цена» (плюс желательно «ед.» и «категория»).",
        total: parsed.total,
        skipped: parsed.skipped,
      },
      { status: 422 }
    );
  }

  const result = await importPrice(userId, parsed.rows);
  return NextResponse.json({
    ok: true,
    total: parsed.total,
    imported: parsed.rows.length,
    skipped: parsed.skipped,
    ...result,
  });
}
