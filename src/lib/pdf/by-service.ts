// Общая смета по нескольким услугам (сервис, уход за садом — Юрий 30.10): КП разбит по
// услугам, у каждой свой подытог. Раздел относится к услуге целиком; общий раздел
// («Работы», «Доставка») — построчно, по названию позиции, остальное — в «Общее».

import type { EstimateGroup } from "@/lib/estimate/service";
import { SERVICES, serviceOfCategory, serviceOfText } from "@/lib/services";

export interface ServiceSection {
  label: string;
  /** Как услугу называют — чтобы не повторять раздел-тёзку подзаголовком. */
  spoken: string[];
  groups: EstimateGroup[];
  subtotal: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Разбивка по услугам; одна услуга (или ни одной) — null, КП остаётся как был. */
export function sectionsByService(groups: EstimateGroup[]): ServiceSection[] | null {
  const byService = new Map<string, EstimateGroup[]>();
  const push = (key: string, g: EstimateGroup) => byService.set(key, [...(byService.get(key) ?? []), g]);

  for (const g of groups) {
    const s = serviceOfCategory(g.category, g.lines.map((l) => l.name));
    if (s) {
      push(s.id, g);
      continue;
    }
    // общий раздел — построчно
    const parts = new Map<string, EstimateGroup["lines"]>();
    for (const l of g.lines) {
      const key = serviceOfText(l.name)?.id ?? "";
      parts.set(key, [...(parts.get(key) ?? []), l]);
    }
    for (const [key, lines] of parts) {
      push(key, { ...g, lines, subtotal: round2(lines.reduce((a, l) => a + l.sum, 0)) });
    }
  }

  const named = SERVICES.filter((s) => byService.has(s.id));
  if (named.length < 2) return null;
  const sections: ServiceSection[] = named.map((s) => {
    const gs = byService.get(s.id)!;
    return { label: s.label, spoken: s.spoken, groups: gs, subtotal: round2(gs.reduce((a, g) => a + g.subtotal, 0)) };
  });
  const general = byService.get("");
  if (general?.length) {
    sections.push({ label: "Общее", spoken: ["общее"], groups: general, subtotal: round2(general.reduce((a, g) => a + g.subtotal, 0)) });
  }
  return sections;
}
