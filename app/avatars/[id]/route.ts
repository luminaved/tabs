import sharp from 'sharp';
import { prisma } from '@/lib/db';
import { avatarVersion } from '@/lib/avatarUrl';
import { createTtlCache } from '@/lib/ttlCache';
import { isAllowedAvatarUrl, servableImageType } from '@/lib/imageInput';
import { adoptRemoteAvatar } from '@/lib/remoteAvatar';

/**
 * Отдача аватара отдельным запросом.
 *
 * Фото лежит в БД как data URL, а шапка есть на каждой странице: вшитый в
 * разметку base64 утяжелял бы вообще все страницы (и заново на каждой). Здесь
 * он пережимается в маленький webp и кэшируется браузером.
 *
 * Картинка от Google приходит внешней ссылкой. Её переносим к себе при первом
 * же обращении (см. lib/remoteAvatar.ts) — один раз на аккаунт, дальше путь
 * полностью локальный: ни браузер, ни сервер к googleusercontent.com больше не
 * ходят. Раньше ссылка отдавалась браузеру как есть, и это была единственная
 * сторонняя загрузка на сайте.
 *
 * Ссылка версионируется отпечатком картинки (`?v=`, см. lib/avatarUrl.ts), и
 * версия входит в ключ кэша. Без неё кэш процесса никогда не промахивался после
 * смены фото, и пользователь видел старый аватар до перезапуска сервера.
 */

const SIZE = 96; // ×2 к самому крупному показу (48px в кабинете)
const CACHE_LIMIT = 100;
const cache = new Map<string, { body: Buffer; type: string }>();

/**
 * Версия аватара (отпечаток картинки) — с коротким сроком годности: он и
 * снимает поход в базу с каждого запроса. 30 секунд — столько после смены фото
 * может отдаваться прежнее.
 */
const META_TTL_MS = 30_000;
const versionCache = createTtlCache<string>(META_TTL_MS, 300);

/** Годится ли значение из БД как аватар: своё фото либо разрешённый адрес. */
function usableAvatar(image: string | null | undefined): image is string {
  if (!image) return false;
  return image.startsWith('data:image/') || isAllowedAvatarUrl(image);
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const format = (req.headers.get('accept') ?? '').includes('image/webp') ? 'webp' : 'jpeg';
  const versioned = !!new URL(req.url).searchParams.get('v');

  // Быстрый путь: версия известна и пережатая картинка уже лежит — отдаём, не
  // трогая базу вовсе. Именно ради него версия и кэшируется отдельно: иначе
  // шапка на каждой странице тянула бы весь base64 (а база в другом полушарии)
  // ради ключа к уже готовой картинке.
  const known = versionCache.get(id);
  if (known) {
    const hit = cache.get(`${id}:${known}:${format}`);
    if (hit) return respond(hit.body, hit.type, versioned);
  }

  const user = await prisma.user.findUnique({ where: { id }, select: { image: true } });
  let image = user?.image;
  if (!usableAvatar(image)) return new Response(null, { status: 404 });

  // Внешний адрес — переносим к себе. Возвращается уже сохранённый data URL.
  if (!image.startsWith('data:')) {
    const adopted = await adoptRemoteAvatar(id, image);
    // Не вышло — 404, и компонент нарисует кружок с инициалом. Пустой кружок
    // лучше сломанной картинки и куда лучше зависшей страницы.
    if (!adopted) return new Response(null, { status: 404 });
    image = adopted;
  }

  // Ключ считается по самой картинке, а не по `?v=` из адреса. Значение из
  // адреса задаёт клиент: случайные `?v=` промахивались мимо кэша и вымывали
  // чужие записи, а каждый промах — это лишний прогон через sharp.
  const version = avatarVersion(image);
  versionCache.set(id, version);

  const key = `${id}:${version}:${format}`;
  const hit = cache.get(key);
  if (hit) return respond(hit.body, hit.type, versioned);

  const m = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(image);
  if (!m) return new Response(null, { status: 404 });
  const source = Buffer.from(m[2], 'base64');

  let body: Buffer;
  let type: string;
  try {
    const pipeline = sharp(source).resize(SIZE, SIZE, { fit: 'cover' });
    if (format === 'webp') {
      body = await pipeline.webp({ quality: 78 }).toBuffer();
      type = 'image/webp';
    } else {
      body = await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
      type = 'image/jpeg';
    }
  } catch {
    // Битая или неподдерживаемая картинка — отдаём как есть, лишь бы показалась.
    // Только растровую: тип приходит из базы, а `image/svg+xml` по прямой
    // ссылке выполняется браузером как документ (см. servableImageType).
    const raw = servableImageType(m[1]);
    if (!raw) return new Response(null, { status: 404 });
    body = source;
    type = raw;
  }

  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { body, type });
  return respond(body, type, versioned);
}

function respond(body: Buffer, type: string, versioned: boolean) {
  return new Response(new Uint8Array(body), {
    headers: {
      'Content-Type': type,
      'Content-Length': String(body.byteLength),
      // С версией в ссылке адрес меняется вместе с картинкой — можно кэшировать
      // надолго. Без неё (старая разметка из кэша) остаёмся осторожными.
      'Cache-Control': versioned
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=300, stale-while-revalidate=3600',
      Vary: 'Accept',
    },
  });
}
