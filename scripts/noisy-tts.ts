// Синтез фразы голосом Яндекса (для проверки распознавания на шуме): npx tsx scripts/noisy-tts.ts <out.raw> "<текст>"
// Получается 16 кГц, 16 бит, моно (lpcm); шум накладывается ffmpeg отдельно.
import "dotenv/config";
import { writeFileSync } from "node:fs";
(async () => {
  const body = new URLSearchParams({ text: process.argv[3], lang: "ru-RU", voice: "filipp", format: "lpcm", sampleRateHertz: "16000", folderId: process.env.YANDEX_FOLDER_ID! });
  const r = await fetch("https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize", { method: "POST", headers: { Authorization: `Api-Key ${process.env.YANDEX_API_KEY}` }, body });
  if (!r.ok) throw new Error(`TTS ${r.status}: ${await r.text()}`);
  writeFileSync(process.argv[2], Buffer.from(await r.arrayBuffer()));
  console.log("ok");
})();
