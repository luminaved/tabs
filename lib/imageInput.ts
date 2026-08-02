/**
 * Проверка картинок, приходящих в серверные экшены (обложка разбора, аватар).
 *
 * Сжатие до 512/256 px живёт в [resizeImage.ts](./resizeImage.ts) — то есть на
 * клиенте, а это не граница: форму можно отправить и мимо браузера. Без проверки
 * здесь в Postgres кладётся base64 любого размера, и дальше маршрут /covers/[id]
 * на каждом промахе кэша поднимает его в память и прогоняет через sharp — одна
 * строка портит жизнь всему процессу.
 *
 * Потолки с запасом к тому, что отдаёт клиент (JPEG 512 px ≈ 40–100 КБ,
 * аватар 256 px ≈ 10–25 КБ): свои картинки проходят, чужие мегабайты — нет.
 */

export const COVER_MAX_BYTES = 400 * 1024;
export const AVATAR_MAX_BYTES = 150 * 1024;

/**
 * Значение поля обложки, означающее «оставить как есть».
 *
 * Нужно, потому что у поля три исхода, а не два: прислали новую картинку,
 * попросили убрать, либо не трогали вовсе. Раньше последних два не различались:
 * пустое поле означало «убрать», поэтому редактор был ОБЯЗАН класть всю
 * картинку в скрытый инпут и возвращать её серверу при каждом сохранении —
 * иначе обложка стиралась. Отсюда и ездил base64 туда-обратно.
 *
 * С сентинелом «не трогали» выражается тремя буквами. Спутать его с картинкой
 * нельзя: data URL всегда начинается с `data:`, а пустая строка по-прежнему
 * значит «убрать».
 */
export const COVER_KEEP = 'keep';

// Что умеет показать браузер и разобрать sharp. Клиент присылает только JPEG,
// но в базе с прошлых версий могут лежать и другие типы — на сохранении их
// незачем ронять.
const DATA_URL_RE = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/;

/** Размер декодированных данных по длине base64 — без самого декодирования. */
function decodedBytes(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return (base64.length / 4) * 3 - padding;
}

/**
 * Картинка как data URL либо null, если это не картинка или она слишком тяжёлая.
 * Пустая строка — это «убрать картинку», тоже null.
 */
export function parseImageDataUrl(raw: string, maxBytes: number): string | null {
  const value = raw.trim();
  if (!value) return null;

  const m = DATA_URL_RE.exec(value);
  if (!m) return null;
  if (decodedBytes(m[2]) > maxBytes) return null;
  return value;
}

/**
 * Что форма просит сделать с обложкой.
 *
 * Вынесено из серверного экшена отдельной чистой функцией ради тестов: спутать
 * «не трогали» с «убрали» — это молча стереть чужую картинку при сохранении
 * любой другой правки, и заметит это только автор, когда будет поздно.
 */
export type CoverChange =
  | { kind: 'keep' }
  | { kind: 'remove' }
  | { kind: 'set'; dataUrl: string }
  | { kind: 'invalid' };

export function parseCoverField(raw: string): CoverChange {
  const value = raw.trim();
  if (value === COVER_KEEP) return { kind: 'keep' };
  if (!value) return { kind: 'remove' };
  const dataUrl = parseImageDataUrl(value, COVER_MAX_BYTES);
  return dataUrl ? { kind: 'set', dataUrl } : { kind: 'invalid' };
}

/**
 * Типы, которые маршруты картинок (/covers, /avatars) могут отдать браузеру
 * СЫРЫМИ, ничего не пережимая.
 *
 * Нужен на аварийной ветке: если sharp не смог разобрать картинку, маршруты
 * отдают исходные байты, лишь бы хоть что-то показалось, и берут Content-Type
 * из самого data URL — то есть из базы. Список выше (`DATA_URL_RE`) новые
 * записи уже ограничивает, но прежняя проверка была `startsWith('data:image/')`
 * и пропускала в том числе `image/svg+xml`. А SVG — не картинка, а документ:
 * при переходе по прямой ссылке на /covers/<id> браузер разбирает его как
 * разметку и выполняет скрипты внутри, причём на НАШЕМ домене. Отдавать сырыми
 * можно только растровые типы; всё остальное — 404.
 */
const SERVABLE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);

/** Тип в нижнем регистре, если его безопасно отдать как есть, иначе null. */
export function servableImageType(type: string): string | null {
  const value = type.trim().toLowerCase();
  return SERVABLE_TYPES.has(value) ? value : null;
}

/**
 * Хосты, с которых принимаем аватар ссылкой. Своё фото приходит data URL'ом,
 * а внешний адрес бывает ровно один — картинка профиля Google (см. lib/auth.ts).
 *
 * Без списка сюда проходил любой `https://`, и аватар превращался в трекер:
 * профиль публичный, картинку грузит каждый посетитель, и чужой сервер собирал
 * бы их адреса. Появится ещё один провайдер входа — добавьте его хост сюда.
 */
const AVATAR_HOSTS = ['googleusercontent.com'];

/**
 * Разрешён ли адрес как источник аватара. Экспортируется, потому что этим же
 * списком ограничен серверный проксирующий запрос в /avatars/[id]: скачивать по
 * адресу из базы можно только с тех же хостов, иначе маршрут превратился бы в
 * средство ходить запросами куда угодно от имени сервера.
 */
export function isAllowedAvatarUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  return AVATAR_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
}

/** Аватар: своё фото (data URL) либо картинка провайдера входа. Иначе — убрать. */
export function parseAvatarInput(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.startsWith('data:')) return parseImageDataUrl(value, AVATAR_MAX_BYTES);
  return isAllowedAvatarUrl(value) ? value : null;
}
