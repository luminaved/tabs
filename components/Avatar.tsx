import { avatarSrc } from '@/lib/avatarUrl';

/** Аватар: картинка (напр. из Google) либо круг с инициалом. */
export function Avatar({
  image,
  name,
  email,
  size = 32,
  userId,
}: {
  image?: string | null;
  name?: string | null;
  email?: string | null;
  size?: number;
  /** Нужен, чтобы загруженный аватар шёл ссылкой, а не base64 в разметке. */
  userId?: string | null;
}) {
  const style = { width: size, height: size };

  if (image) {
    // Загруженный аватар (data URL) отдаём маршрутом: иначе он вшивается в
    // HTML каждой страницы. Внешние ссылки (Google) — как есть. Без userId
    // (превью только что выбранного файла в редакторе профиля — в БД его ещё
    // нет) показываем data URL напрямую.
    const src = userId ? avatarSrc(userId, image) : image;
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
