import { avatarSrc } from '@/lib/avatarUrl';

/**
 * Аватар: картинка либо круг с инициалом.
 *
 * Источников два, и они не пересекаются:
 *   — `userId` + `version` — обычный случай. Картинка приходит отдельным
 *     кэшируемым запросом на /avatars/[id], а на страницу попадает только
 *     короткий отпечаток. Ни base64, ни адрес Google в разметке не появляются.
 *   — `image` — только превью в редакторе профиля: файл сжат в data URL прямо
 *     в браузере, в базе его ещё нет, и показать его можно лишь напрямую.
 */
export function Avatar({
  image,
  version,
  name,
  email,
  size = 32,
  userId,
}: {
  /** Data URL для превью только что выбранного файла (в БД его ещё нет). */
  image?: string | null;
  /** Отпечаток картинки из БД — вместе с `userId` даёт ссылку на маршрут. */
  version?: string | null;
  name?: string | null;
  email?: string | null;
  size?: number;
  userId?: string | null;
}) {
  const style = { width: size, height: size };
  const src = userId && version ? avatarSrc(userId, version) : (image ?? null);

  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className="avatar"
        style={style}
        decoding="async"
        referrerPolicy="no-referrer"
      />
    );
  }

  const initial = (name?.trim()?.[0] ?? email?.trim()?.[0] ?? '?').toUpperCase();
  return (
    <span className="avatar avatar-fallback" style={{ ...style, fontSize: size * 0.44 }} aria-hidden>
      {initial}
    </span>
  );
}
