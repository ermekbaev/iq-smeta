// Предмет КП («Коммерческое предложение НА …») из услуг сметы.
// Не дословный перенос слов и не список категорий, а профессиональная
// формулировка по шаблонам — так просил заказчик (надёжнее ИИ-генерации).
// Раздел прайса сначала раскладывается по услуге (src/lib/services.ts): у Юрия
// разделы названы как у поставщика («Соединения компрессионные (IRRITEC)»), и
// раньше любой незнакомый раздел превращал КП по поливу в «комплекс по
// благоустройству» (Юрий 30.10).

import { mapCategories, serviceOfCategory, subjectFor } from "@/lib/services";

/** Предмет по одним названиям разделов (без позиций). */
export function autoSubject(categories: string[]): string {
  return subjectFor(categories.map((c) => serviceOfCategory(c)));
}

/** Предмет по позициям сметы: раздел без явной услуги в названии решается по его позициям. */
export function autoSubjectFromItems(items: { category: string; name: string }[]): string {
  return subjectFor([...mapCategories(items).values()]);
}
