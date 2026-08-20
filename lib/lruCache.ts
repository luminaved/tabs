/**
 * Кэш в памяти процесса с вытеснением по давности ОБРАЩЕНИЯ.
 *
 * Нужен маршрутам картинок (/covers, /avatars, opengraph-image). Там лежат уже
 * пережатые буферы, и промах стоит не поход в базу, а прогон через sharp —
 * десятки миллисекунд CPU на каждую.
 *
 * Раньше каждый из этих маршрутов вытеснял записи сам, и вытеснял по порядку
 * ВСТАВКИ: `cache.keys().next()` возвращает первый добавленный ключ независимо
 * от того, как часто его спрашивают. То есть под нагрузкой из хвоста каталога
 * первыми выбрасывались обложки первой страницы — ровно те, которые запрашивают
 * чаще всего, и их пережимало заново по кругу. Здесь `get` переставляет запись
 * в конец, поэтому вылетает действительно давно не нужное.
 *
 * От `createTtlCache` отличается тем, чего у записей нет срока годности: ключ
 * включает версию (`updatedAt` разбора, отпечаток аватара), поэтому устаревшая
 * запись не отдаётся никогда — на неё просто перестают ссылаться, и она
 * вытесняется как любая другая давно не спрошенная.
 */

export interface LruCache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
}

export function createLruCache<T>(limit: number): LruCache<T> {
  const map = new Map<string, T>();

  return {
    get(key) {
      const hit = map.get(key);
      if (hit === undefined) return undefined;
      // Перестановка в конец и есть весь LRU: Map хранит порядок вставки,
      // а повторный `set` после `delete` кладёт ключ последним.
      map.delete(key);
      map.set(key, hit);
      return hit;
    },

    set(key, value) {
      map.delete(key);
      map.set(key, value);
      while (map.size > limit) {
        const oldest = map.keys().next().value;
        if (oldest === undefined) break;
        map.delete(oldest);
      }
    },
  };
}
