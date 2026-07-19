import { describe, it, expect } from "vitest";
import { parseStringArray, parseVerdict } from "./synonyms-ai";

describe("parseStringArray — ответ ИИ на подсказку синонимов", () => {
  it("чистый JSON-массив", () => {
    expect(parseStringArray('["форсунка","распылитель"]')).toEqual([
      "форсунка",
      "распылитель",
    ]);
  });

  it("массив в ```json-обёртке и с текстом вокруг", () => {
    const raw = 'Вот варианты:\n```json\n["спринклер", "дождеватель"]\n```\nготово';
    expect(parseStringArray(raw)).toEqual(["спринклер", "дождеватель"]);
  });

  it("не-строки отфильтрованы, мусор → []", () => {
    expect(parseStringArray('["ок", 5, null, "да"]')).toEqual(["ок", "да"]);
    expect(parseStringArray("нет тут json")).toEqual([]);
    expect(parseStringArray("[]")).toEqual([]);
  });
});

describe("parseVerdict — ответ ИИ на проверку группы", () => {
  it("ok:true / ok:false с примечанием", () => {
    expect(parseVerdict('{"ok":true,"note":""}')).toEqual({ ok: true, note: "" });
    expect(parseVerdict('{"ok":false,"note":"разные изделия"}')).toEqual({
      ok: false,
      note: "разные изделия",
    });
  });

  it("обёртки/текст вокруг объекта разбираются", () => {
    expect(parseVerdict('Ответ: {"ok": false, "note": "труба ≠ кабель"} .')).toEqual({
      ok: false,
      note: "труба ≠ кабель",
    });
  });

  it("некорректный ответ трактуется как «ок» (не блокируем человека)", () => {
    expect(parseVerdict("совсем не json")).toEqual({ ok: true, note: "" });
    expect(parseVerdict('{"note":"без поля ok"}')).toEqual({ ok: true, note: "без поля ok" });
  });
});
