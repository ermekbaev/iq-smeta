// Услуги благоустройства — понятный список вместо разделов поставщика
// («Соединения компрессионные (IRRITEC)» → Автополив). Юрий 30.10: «выбрал услугу —
// ничего лишнего не попадает, и заголовок КП точный». Чистая логика (без БД):
// раздел прайса раскладывается по услуге по ключевым словам в его названии,
// а если в названии их нет — большинством по названиям позиций раздела.

export interface Service {
  id: string;
  /** Название в списке и в голосе. */
  label: string;
  /** Предмет КП после «на» (винительный падеж). */
  subject: string;
  /** Как называют услугу голосом (для команды «бери из …» и «КП по …»). */
  spoken: string[];
  /** Начала слов (нижний регистр), по которым раздел или позиция относятся к услуге. */
  stems: string[];
}

export const SERVICES: Service[] = [
  {
    id: "irrigation",
    label: "Автополив",
    subject: "устройство системы автоматического полива",
    spoken: ["автополив", "полив", "орошение"],
    stems: ["полив", "автополив", "дождев", "форсун", "сопл", "капельн", "ороше", "ниппел", "пнд", "irritec", "hunter", "rain bird", "rainbird", "toro", "rain", "компрессионн", "датчик дожд", "электромагнитн", "клапан", "насос", "прессконтрол", "емкост", "poelsan", "aquario", "седелк", "кран шаров", "водоисточ", "насосн станц"],
  },
  {
    id: "lighting",
    label: "Освещение",
    subject: "устройство системы ландшафтного освещения",
    spoken: ["освещение", "свет", "подсветка"],
    stems: ["освещ", "свет", "подсвет", "прожект", "спот", "ламп", "led", "неон", "arlight", "swg", "трансформатор", "блок питан", "драйвер", "торшер", "вольт", "электрокабел", "кабель силов", "щит", "розеточн", "линз", "электропитан", "труба кабельн"],
  },
  {
    id: "fog",
    label: "Туманообразование",
    subject: "устройство системы туманообразования",
    spoken: ["туманообразование", "туман"],
    stems: ["туман"],
  },
  {
    id: "drainage",
    label: "Дренаж",
    subject: "монтаж дренажной системы",
    spoken: ["дренаж", "дренажная система"],
    stems: ["дренаж", "геотекстил", "перфорир"],
  },
  {
    id: "storm",
    label: "Ливнёвка",
    subject: "устройство ливневой канализации",
    spoken: ["ливнёвка", "ливневка", "ливневая канализация", "водоотвод"],
    stems: ["ливнев", "ливнёв", "водоотвод", "лоток", "дождеприем", "дождеприём", "пескоулов"],
  },
  {
    id: "earth",
    label: "Земляные работы",
    subject: "выполнение земляных работ",
    spoken: ["земляные работы", "земляные", "копка"],
    stems: ["землян", "траншея", "траншей", "траншеи", "выемк", "копк", "разработк грунт", "планировк", "вывоз грунт", "экскаватор"],
  },
  {
    id: "lawn",
    label: "Газон",
    subject: "укладку рулонного газона",
    spoken: ["газон", "рулонный газон"],
    stems: ["газон"],
  },
  {
    id: "planting",
    label: "Озеленение",
    subject: "озеленение территории",
    spoken: ["озеленение", "посадка", "растения"],
    stems: ["озелен", "посадк", "саженц", "дерев", "кустарн", "растени", "туя", "туи", "мульч", "кора "],
  },
  {
    id: "paving",
    label: "Мощение",
    subject: "устройство мощения дорожек и площадок",
    spoken: ["мощение", "брусчатка", "плитка"],
    stems: ["мощен", "брусчат", "плитк", "бордюр", "поребрик", "тротуарн", "клинкер"],
  },
  {
    id: "concrete",
    label: "Бетонные работы",
    subject: "устройство бетонных фундаментов",
    spoken: ["бетонные работы", "бетон", "фундамент", "заливка бетона"],
    stems: ["бетон", "фундамент", "арматур", "опалубк", "стяжк"],
  },
  {
    id: "terrace",
    label: "Террасы",
    subject: "устройство террасы",
    spoken: ["террасы", "терраса", "декинг"],
    stems: ["террас", "декинг", "лаг"],
  },
  {
    id: "rubber",
    label: "Резиновые покрытия",
    subject: "устройство резиновых покрытий",
    spoken: ["резиновые покрытия", "резиновое покрытие", "каменный ковёр"],
    stems: ["резинов", "крошк", "каменный ков", "каменного ков"],
  },
];

export const GENERAL_SUBJECT = "комплекс работ по благоустройству";

// при равенстве узкая услуга сильнее: «насос дренажный» — дренаж, а не полив
const NARROW = ["fog", "drainage", "storm"];
const CLASSIFY_ORDER = [...SERVICES.filter((s) => NARROW.includes(s.id)), ...SERVICES.filter((s) => !NARROW.includes(s.id))];

const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е");

/** Сколько ключевых слов услуги встречается в тексте (по началам слов). */
function hits(text: string, s: Service): number {
  const t = ` ${norm(text).replace(/[^a-zа-я0-9 ]+/g, " ")} `;
  return s.stems.reduce((n, stem) => n + (t.includes(` ${norm(stem)}`) ? 1 : 0), 0);
}

/** Услуга по одной строке (названию раздела или позиции); нет явных слов — null. */
export function serviceOfText(text: string): Service | null {
  let best: Service | null = null;
  let bestHits = 0;
  for (const s of CLASSIFY_ORDER) {
    const h = hits(text, s);
    if (h > bestHits) {
      best = s;
      bestHits = h;
    }
  }
  return best;
}

/**
 * Услуга раздела прайса: по его названию, а если оно ничего не говорит
 * («Соединения», «Прочее», «Расходники») — большинством по названиям позиций.
 * Общие разделы (доставка, расходники) остаются без услуги — null.
 */
export function serviceOfCategory(category: string, itemNames: string[] = []): Service | null {
  const byName = serviceOfText(category);
  if (byName) return byName;
  const votes = new Map<string, number>();
  for (const name of itemNames) {
    const s = serviceOfText(name);
    if (s) votes.set(s.id, (votes.get(s.id) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestVotes = 0;
  for (const [id, v] of votes) {
    if (v > bestVotes) {
      best = id;
      bestVotes = v;
    }
  }
  // раздел целиком за услугой, только если узнаваемые позиции почти все про неё (≥80%)
  // и их хотя бы треть: «Работы» с монтажом дождевателя и светильника — общий раздел
  const known = [...votes.values()].reduce((a, v) => a + v, 0);
  if (!best || bestVotes * 5 < known * 4 || known * 3 < itemNames.length) return null;
  return SERVICES.find((s) => s.id === best) ?? null;
}

/** Раздел → услуга для всех разделов прайса (позиции сгруппированы по разделу). */
export function mapCategories(items: { category: string; name: string }[]): Map<string, Service | null> {
  const byCat = new Map<string, string[]>();
  for (const it of items) {
    const list = byCat.get(it.category) ?? [];
    list.push(it.name);
    byCat.set(it.category, list);
  }
  return new Map([...byCat].map(([cat, names]) => [cat, serviceOfCategory(cat, names)]));
}

export const serviceById = (id: string | null | undefined) => SERVICES.find((s) => s.id === id) ?? null;

/**
 * Позиции прайса, из которых подбирать при выбранной услуге. Раздел услуги — целиком;
 * в общем разделе — позиции этой услуги по названию и общее без услуги (песок, доставка),
 * а позиции чужих услуг («Прочее»: бетон, мощение) — нет.
 */
export function scopeIds(items: { id: string; category: string; name: string }[], serviceId: string): string[] {
  const map = mapCategories(items);
  return items
    .filter((it) => {
      const cat = map.get(it.category);
      if (cat) return cat.id === serviceId;
      const own = serviceOfText(it.name);
      return !own || own.id === serviceId;
    })
    .map((it) => it.id);
}

/** Сколько позиций относится к услуге явно (раздел или название) — для списка услуг. */
export function serviceCounts(items: { category: string; name: string }[]): Map<string, number> {
  const map = mapCategories(items);
  const out = new Map<string, number>();
  for (const it of items) {
    const s = map.get(it.category) ?? serviceOfText(it.name);
    if (s) out.set(s.id, (out.get(s.id) ?? 0) + 1);
  }
  return out;
}

/** Предмет КП по услугам сметы: одна — её формулировка, две — через «и», больше — комплекс. */
export function subjectFor(services: (Service | null)[]): string {
  const uniq = [...new Map(services.filter((s): s is Service => !!s).map((s) => [s.id, s])).values()];
  if (uniq.length === 0) return "";
  if (uniq.length >= 3) return `на ${GENERAL_SUBJECT}`;
  if (uniq.length === 2) return `на ${uniq[0].subject} и ${uniq[1].subject}`;
  return `на ${uniq[0].subject}`;
}

/**
 * Услуга, названная в начале диктовки: «КП по автополиву…», «смета на освещение…».
 * Ищем только в начале — дальше «полив» может быть обычной позицией.
 */
export function serviceInHead(text: string): Service | null {
  const head = norm(text).slice(0, 80);
  // в самом начале, допускаем пару слов перед («так, КП по…» не ловим — только «вот КП по…», «новая смета на…»)
  const m = head.match(/^\s*(?:[а-яa-z]+\s+){0,2}?(?:кп|коммерческое предложение|смет[аеуы]|предложение)\s+(?:на|по)\s+([^,.;:!?]+)/);
  if (!m) return null;
  const rest = m[1];
  for (const s of SERVICES) {
    if (s.spoken.some((w) => rest.startsWith(norm(w).slice(0, Math.max(4, norm(w).length - 2))))) return s;
  }
  return serviceOfText(rest);
}
