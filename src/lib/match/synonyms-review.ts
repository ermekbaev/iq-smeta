// Сведение личных словарей всех аккаунтов для обзора сопровождающим:
// одинаковые группы схлопываются, помечается наличие в общей базе.
// Чистая логика (без БД) — тестируемая.

export interface ReviewItem {
  terms: string[];
  accounts: string[];
  inGlobal: boolean;
}

export const normTerms = (terms: string[]): string[] =>
  [...new Set(terms.map((t) => t.trim().toLowerCase()).filter(Boolean))].sort();

export function aggregateReview(
  personal: { terms: string[]; email: string | null }[],
  global: string[][]
): ReviewItem[] {
  const globalSets = global.map((g) => new Set(normTerms(g)));
  // покрыта, если в общей базе есть группа, включающая ВСЕ слова этой группы
  const covered = (terms: string[]) => globalSets.some((s) => terms.every((t) => s.has(t)));

  const byKey = new Map<string, { terms: string[]; accounts: Set<string> }>();
  for (const row of personal) {
    const terms = normTerms(row.terms);
    if (terms.length < 2) continue; // группа из одного слова смысла не имеет
    const key = terms.join("|");
    const entry = byKey.get(key) ?? { terms, accounts: new Set<string>() };
    if (row.email) entry.accounts.add(row.email);
    byKey.set(key, entry);
  }

  return [...byKey.values()]
    .map((e) => ({
      terms: e.terms,
      accounts: [...e.accounts].sort(),
      inGlobal: covered(e.terms),
    }))
    // сначала то, чего нет в общей базе; внутри — что просят чаще
    .sort(
      (a, b) =>
        Number(a.inGlobal) - Number(b.inGlobal) ||
        b.accounts.length - a.accounts.length ||
        a.terms[0].localeCompare(b.terms[0])
    );
}
