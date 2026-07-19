// Кто ведёт ОБЩУЮ базу синонимов (вариант A). Один сопровождающий аккаунт (IQ) —
// его определяем по e-mail из env. Остальные видят и правят только свои личные группы,
// но при подборе общая база применяется у всех (см. expandWithSynonyms).

export function globalSynonymEmail(): string {
  return (
    process.env.GLOBAL_SYNONYM_EMAIL ||
    process.env.ADMIN_EMAIL ||
    "admin@iqsmeta.local"
  )
    .trim()
    .toLowerCase();
}

export function isGlobalSynonymAdmin(email?: string | null): boolean {
  return !!email && email.trim().toLowerCase() === globalSynonymEmail();
}
