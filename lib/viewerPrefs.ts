/**
 * Настройки читалки в localStorage.
 *
 * Транспонирование хранится ОТДЕЛЬНО для каждой песни: оно про конкретную вещь
 * (подобрали под голос — хочется вернуться к тому же). Размер шрифта, скорость
 * автоскролла, показ аккордов и «не гасить экран» — общие: это про то, как
 * человеку удобно читать вообще, и переносятся на любую песню.
 */

// Как и у черновиков, префикс оставлен старым: переименование сбросило бы у
// всех транспонирование, размер шрифта и остальные настройки чтения.
const PREFIX = 'tabs.viewer.v1.';

export const viewerKeys = {
  transpose: (songId: string) => `${PREFIX}transpose.${songId}`,
  fontSize: `${PREFIX}fontSize`,
  speed: `${PREFIX}speed`,
  showChords: `${PREFIX}showChords`,
  pinChords: `${PREFIX}pinChords`,
  /**
   * «Не гасить экран». Настройка сеанса игры, а не одной песни: человек берёт
   * гитару и открывает подряд пять разборов — переключать замок на каждом было
   * бы издевательством.
   */
  wakeLock: `${PREFIX}wakeLock`,
};

function read(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // приватный режим либо хранилище отключено
  }
}

/** Записывает значение; `null` удаляет ключ (возврат к значению по умолчанию). */
export function writePref(key: string, value: string | number | boolean | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, String(value));
  } catch {
    /* переполнена квота — живём без сохранения */
  }
}

/**
 * Число из хранилища с проверкой границ. Возвращает null, если значения нет
 * или оно испорчено — вызывающий код берёт своё значение по умолчанию.
 */
export function readNumberPref(key: string, min: number, max: number): number | null {
  const raw = read(key);
  if (raw === null || raw.trim() === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

/** Целое число в границах (транспонирование, скорость). */
export function readIntPref(key: string, min: number, max: number): number | null {
  const n = readNumberPref(key, min, max);
  return n === null ? null : Math.trunc(n);
}

export function readBoolPref(key: string): boolean | null {
  const raw = read(key);
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return null;
}
