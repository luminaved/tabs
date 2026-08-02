/**
 * Кэш в памяти процесса с ограниченным сроком годности.
 *
 * Нужен маршрутам картинок (/covers, /avatars). Там кэшируется уже пережатая
 * картинка, но перед выдачей надо знать, что разбор всё ещё публичный и что
 * версия та самая — а это поход в базу. База лежит в другом полушарии (~45 мс
 * на запрос), и на каталоге с двумя десятками обложек эти запросы складывались
 * в заметную задержку, хотя сами картинки давно лежали готовыми.
 *
 * Срок годности — компромисс: скрытая обложка ещё какое-то время отдаётся из
 * памяти. Окно короткое и понятное, в отличие от «навсегда», как было бы, читай
 * мы кэш вообще без проверки. Браузеру картинка всё равно уходит с длинным
 * max-age, так что сервер здесь не единственный и не последний рубеж.
 */

interface Entry<T> {
  value: T;
  expiresAt: number;
}

export interface TtlCache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
}

export function createTtlCache<T>(ttlMs: number, limit: number): TtlCache<T> {
  const map = new Map<string, Entry<T>>();

  return {
    get(key) {
      const hit = map.get(key);
      if (!hit) return undefined;
      if (hit.expiresAt <= Date.now()) {
        map.delete(key);
        return undefined;
      }
      return hit.value;
    },

    set(key, value) {
      if (map.size >= limit) {
        // Сначала выбрасываем протухшее, и только если его не набралось —
        // самые старые записи (Map хранит порядок вставки).
        const now = Date.now();
        for (const [k, v] of map) {
          if (v.expiresAt <= now) map.delete(k);
        }
        while (map.size >= limit) {
          const oldest = map.keys().next().value;
          if (oldest === undefined) break;
          map.delete(oldest);
        }
      }
      map.set(key, { value, expiresAt: Date.now() + ttlMs });
    },
  };
}
