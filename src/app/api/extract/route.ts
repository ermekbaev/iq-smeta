import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { ai } from "@/lib/ai";

export const runtime = "nodejs";

const schema = z.object({ text: z.string().min(1) });

// POST /api/extract — расшифрованный текст → структурированные позиции (PLAN 3.4).
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Передайте текст" }, { status: 400 });
  }

  try {
    const items = await ai.llm.extractItems(parsed.data.text);
    if (items.length === 0) {
      // PLAN 3.4a — внятная ошибка вместо молчания
      return NextResponse.json(
        { error: "Не удалось выделить позиции. Поправьте текст вручную." },
        { status: 422 }
      );
    }
    return NextResponse.json({ ok: true, items });
  } catch {
    return NextResponse.json(
      { error: "Сбой извлечения позиций. Попробуйте ещё раз." },
      { status: 502 }
    );
  }
}
