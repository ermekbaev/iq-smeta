import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { rateLimit } from "@/lib/rate-limit";
import { ai } from "@/lib/ai";

export const runtime = "nodejs";

// POST /api/asr — аудио (multipart "audio") → распознанный текст.
// В dev работает mock-провайдер (PLAN 3.1); прод — Яндекс SpeechKit/GigaChat.
export async function POST(req: Request) {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  const { userId } = gate;

  // лимит на дорогой ИИ-роут: длинная диктовка режется на куски, поэтому щедро
  const rl = rateLimit(`asr:${userId}`, 40, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком много запросов, подождите немного." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const form = await req.formData();
  const audio = form.get("audio");
  if (!(audio instanceof File)) {
    return NextResponse.json({ error: "Аудио не передано" }, { status: 400 });
  }

  try {
    const buf = Buffer.from(await audio.arrayBuffer());
    const { text } = await ai.asr.transcribe(buf, { mimeType: audio.type });
    if (!text.trim()) {
      // PLAN 3.4a — внятная ошибка вместо молчания
      return NextResponse.json(
        { error: "Не удалось расслышать. Повторите запись." },
        { status: 422 }
      );
    }
    return NextResponse.json({ ok: true, text });
  } catch (e) {
    console.error("ASR error:", e);
    return NextResponse.json(
      { error: "Сбой распознавания. Попробуйте ещё раз." },
      { status: 502 }
    );
  }
}
