import { describe, it, expect } from "vitest";
import { brandWords } from "./vocabulary";
import { extractPrompt, EXTRACT_SYSTEM_PROMPT } from "./prompt";
import { fuzzyScore, soundKey } from "@/lib/match/fuzzy";

describe("ослышки: словарь компании и звучание", () => {
  it("бренды и серии из названий, без размеров и единиц", () => {
    const w = brandWords(["Дождеватель PROS-04 (HUNTER)", "Роторный дождеватель PGP-04 Ultra (HUNTER)", "Светильник LED IP67 SGL CALLA-02"]);
    expect(w[0]).toBe("HUNTER");
    expect(w).toContain("CALLA");
    expect(w).not.toContain("LED");
    expect(w).not.toContain("IP67");
  });

  it("словарь попадает в задание нейросети, без словаря — прежнее задание", () => {
    expect(extractPrompt()).toBe(EXTRACT_SYSTEM_PROMPT);
    expect(extractPrompt(["HUNTER", "CALLA"])).toContain("HUNTER, CALLA");
  });

  it("кириллица ↔ латиница по звучанию", () => {
    expect(soundKey("хантер")).toBe(soundKey("HUNTER"));
    expect(fuzzyScore("хантер", "Дождеватель HUNTER")).toBeGreaterThan(fuzzyScore("хантер", "Дождеватель PROS"));
    expect(fuzzyScore("рейн берд", "RAIN BIRD")).toBeGreaterThan(0.5);
    // обычное сравнение (один алфавит) не меняется
    expect(fuzzyScore("дождеватель", "дождеватель")).toBe(1);
  });
});
