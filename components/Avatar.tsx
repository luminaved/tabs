/** Аватар: картинка (напр. из Google) либо круг с инициалом. */
export function Avatar({
  image,
  name,
  email,
  size = 32,
}: {
  image?: string | null;
  name?: string | null;
  email?: string | null;
  size?: number;
}) {
  const style = { width: size, height: size };

  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt="" className="avatar" style={style} referrerPolicy="no-referrer" />;
  }

  const initial = (name?.trim()?.[0] ?? email?.trim()?.[0] ?? '?').toUpperCase();
  return (
    <span className="avatar avatar-fallback" style={{ ...style, fontSize: size * 0.44 }} aria-hidden>
      {initial}
    </span>
  );
}
