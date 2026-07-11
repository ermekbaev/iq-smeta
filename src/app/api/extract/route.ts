import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { rateLimit } from "@/lib/rate-limit";
import { ai } from "@/lib/ai";

export const runtime = "nodejs";

const schema = z.object({ text: z.string().min(1) });

// POST /api/extract — расшифрованный текст → структурированные позиции (PLAN 3.4).
export async function POST(req: Request) {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  const { userId } = gate;

  const rl = rateLimit(`extract:${userId}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком много запросов, подождите немного." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Передайте текст" }, { status: 400 });
  }

  try {
    const { object, client, items } = await ai.llm.extractItems(parsed.data.text);
    if (items.length === 0) {
      // PLAN 3.4a — внятная ошибка вместо молчания
      return NextResponse.json(
        { error: "Не удалось выделить позиции. Поправьте текст вручную." },
        { status: 422 }
      );
    }
    return NextResponse.json({ ok: true, items, object, client });
  } catch {
    return NextResponse.json(
      { error: "Сбой извлечения позиций. Попробуйте ещё раз." },
      { status: 502 }
    );
  }
}
