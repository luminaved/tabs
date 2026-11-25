import sharp from 'sharp';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { coverVersion } from '@/lib/coverUrl';
import { createTtlCache } from '@/lib/ttlCache';
import { createLruCache } from '@/lib/lruCache';
import { servableImageType } from '@/lib/imageInput';

/**
 * Отдача обложки отдельным запросом вместо инлайна base64 в HTML.
 *
 * Обложки хранятся в БД как data URL (JPEG, до 512px). Здесь они пережимаются
 * под фактический размер показа и в современный формат (AVIF/WebP по заголовку
 * Accept), поэтому в списках вместо ~40–100 КБ уходит несколько килобайт.
 * Результат кэшируется браузером/CDN надолго — ссылка версионируется через ?v=.
 */

// Размеры показа с запасом под retina (×2): sm — миниатюра в списках (56px),
// md — обложка на странице разбора (до 136px).
const SIZES = { sm: 128, md: 288 } as const;
type SizeKey = keyof typeof SIZES;

// Кэш пережатых вариантов в памяти процесса: ключ учитывает версию, размер и
// формат. Нужен на случай, если перед приложением нет CDN — иначе одна и та же
// картинка пережималась бы на каждый запрос.
const CACHE_LIMIT = 200;
const cache = createLruCache<{ body: Buffer; type: string }>(CACHE_LIMIT);

/**
 * Короткие колонки разбора — отдельным кэшем со сроком годности. Именно он
 * снимает поход в базу с каждого запроса обложки. 30 секунд: столько может
 * прожить уже скрытая обложка, прежде чем маршрут о скрытии узнает.
 */
const META_TTL_MS = 30_000;
const meta = createTtlCache<{
  visibility: string;
  hasCover: boolean;
  updatedAt: Date;
  /** Нужен, чтобы отдать приватную обложку автору и никому больше. */
  userId: string;
}>(META_TTL_MS, 500);

/**
 * WebP при поддержке, иначе JPEG. AVIF намеренно не используем: на картинках
 * такого размера он не мельче webp (замерено), а кодируется втрое дольше.
 */
function pickFormat(accept: string): 'webp' | 'jpeg' {
  return accept.includes('image/webp') ? 'webp' : 'jpeg';
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const sizeParam = url.searchParams.get('s');
  const size: SizeKey = sizeParam === 'sm' ? 'sm' : 'md';
  const format = pickFormat(req.headers.get('accept') ?? '');

  // Видимость и версия проверяются до обращения к кэшу картинок: иначе
  // обложка, ставшая приватной, продолжала бы отдаваться из памяти процесса по
  // прежнему адресу. Но ходить за этим в базу на КАЖДЫЙ запрос — дорого:
  // на каталоге два десятка обложек, а база в другом полушарии (~45 мс на
  // запрос), и готовые картинки ждали эти запросы впустую. Поэтому короткие
  // колонки держим в кэше с коротким сроком годности (см. lib/ttlCache.ts).
  let song = meta.get(id);
  if (!song) {
    const row = await prisma.song.findUnique({
      where: { id },
      select: { visibility: true, hasCover: true, updatedAt: true, userId: true },
    });
    // Отсутствие разбора тоже запоминаем — иначе перебор несуществующих id
    // бил бы в базу без ограничений.
    song = row ?? { visibility: 'private', hasCover: false, updatedAt: new Date(0), userId: '' };
    meta.set(id, song);
  }

  if (!song.hasCover) return new Response(null, { status: 404 });

  /**
   * Приватную обложку отдаём ТОЛЬКО автору.
   *
   * Раньше здесь стоял безусловный 404, и этого хватало: редактор брал картинку
   * не отсюда, а инлайном из разметки. Теперь он ходит на этот маршрут (base64
   * из формы убран), а разборы по умолчанию приватные — то есть без этой ветки
   * автор не видел бы собственную обложку, пока её редактирует.
   *
   * Сессию спрашиваем только на приватной ветке: публичный каталог — это два
   * десятка обложек на страницу, и платить за каждую ещё и разбором токена
   * незачем. Проверка стоит ДО кэша картинок, поэтому чужой запрос упрётся в
   * 404 даже если картинка уже лежит в памяти процесса.
   */
  const ownerOnly = song.visibility === 'private';
  if (ownerOnly) {
    const session = await auth();
    if (!session?.user?.id || session.user.id !== song.userId) {
      return new Response(null, { status: 404 });
    }
  }

  // Версия — из базы, а не из `?v=`. Значение из адреса задаёт клиент, и как
  // часть ключа кэша оно позволяло случайными `?v=` вымывать чужие записи,
  // заставляя пережимать картинку заново на каждый запрос. Теперь чужой `?v=`
  // просто попадает в ту же запись, что и правильный.
  const key = `${id}:${coverVersion(song.updatedAt)}:${size}:${format}`;
  const hit = cache.get(key);
  if (hit) return respond(hit.body, hit.type, ownerOnly);

  const full = await prisma.song.findUnique({ where: { id }, select: { coverUrl: true } });
  if (!full?.coverUrl) return new Response(null, { status: 404 });

  const m = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(full.coverUrl);
  if (!m) return new Response(null, { status: 404 });

  const source = Buffer.from(m[2], 'base64');

  let body: Buffer;
  let type: string;
  try {
    // Квадрат — не потеря пропорции по недосмотру: обложка на сайте квадратная
    // везде (.cover-sm в списках, .cover-fill на странице разбора), и в базу
    // она попадает уже квадратной — до 512×512 её жмёт сам редактор
    // (lib/resizeImage.ts). То есть здесь `cover` практически ничего не режет.
    const pipeline = sharp(source).resize(SIZES[size], SIZES[size], { fit: 'cover' });
    if (format === 'webp') {
      body = await pipeline.webp({ quality: 76 }).toBuffer();
      type = 'image/webp';
    } else {
      body = await pipeline.jpeg({ quality: 80, mozjpeg: true }).toBuffer();
      type = 'image/jpeg';
    }
  } catch {
    // Битая или неподдерживаемая картинка — отдаём как есть, лишь бы показалась.
    // Но только растровую: тип берётся из базы, а `image/svg+xml` браузер по
    // прямой ссылке разберёт как документ и выполнит скрипты внутри — на нашем
    // домене (см. servableImageType).
    const raw = servableImageType(m[1]);
    if (!raw) return new Response(null, { status: 404 });
    body = source;
    type = raw;
  }

  cache.set(key, { body, type });
  return respond(body, type, ownerOnly);
}

function respond(body: Buffer, type: string, ownerOnly = false) {
  return new Response(new Uint8Array(body), {
    headers: {
      'Content-Type': type,
      'Content-Length': String(body.byteLength),
      // Ссылка версионируется через ?v=, поэтому кэшируем надолго. Но обложку
      // приватного разбора видит ровно один человек — такую общий кэш (CDN,
      // прокси) складывать к себе не должен, иначе он раздаст её следующему
      // запросившему в обход проверки выше. Отсюда `private`.
      'Cache-Control': ownerOnly
        ? 'private, max-age=31536000, immutable'
        : 'public, max-age=31536000, immutable',
      // Формат зависит от Accept — CDN обязан учитывать это в ключе кэша.
      Vary: 'Accept',
    },
  });
}
