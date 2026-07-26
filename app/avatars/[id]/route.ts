import sharp from 'sharp';
import { prisma } from '@/lib/db';

/**
 * Отдача загруженного аватара отдельным запросом.
 *
 * Аватар хранится в БД как data URL, а шапка есть на каждой странице — вшитый
 * в разметку base64 утяжелял бы вообще все страницы (и заново на каждой).
 * Здесь он пережимается в маленький webp и кэшируется браузером.
 * Аватары Google — обычные внешние ссылки, сюда не попадают.
 *
 * Ссылка версионируется отпечатком картинки (`?v=`, см. lib/avatarUrl.ts), и
 * версия входит в ключ кэша. Без неё кэш процесса никогда не промахивался после
 * смены фото, и пользователь видел старый аватар до перезапуска сервера.
 */

const SIZE = 96; // ×2 к самому крупному показу (48px в кабинете)
const CACHE_LIMIT = 100;
const cache = new Map<string, { body: Buffer; type: string }>();

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const format = (req.headers.get('accept') ?? '').includes('image/webp') ? 'webp' : 'jpeg';
  const version = new URL(req.url).searchParams.get('v') ?? '';
  const key = `${id}:${version}:${format}`;

  const hit = cache.get(key);
  if (hit) return respond(hit.body, hit.type, !!version);

  const user = await prisma.user.findUnique({ where: { id }, select: { image: true } });
  const image = user?.image;
  if (!image?.startsWith('data:image/')) return new Response(null, { status: 404 });

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
    body = source;
    type = m[1];
  }

  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { body, type });
  return respond(body, type, !!version);
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
