import sharp from 'sharp';
import { prisma } from '@/lib/db';

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
const cache = new Map<string, { body: Buffer; type: string }>();

function remember(key: string, value: { body: Buffer; type: string }) {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

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
  const version = url.searchParams.get('v') ?? '';
  const format = pickFormat(req.headers.get('accept') ?? '');

  const key = `${id}:${version}:${size}:${format}`;
  const hit = cache.get(key);
  if (hit) return respond(hit.body, hit.type);

  const song = await prisma.song.findUnique({
    where: { id },
    select: { coverUrl: true, visibility: true },
  });

  // Приватные обложки не отдаём: картинка не должна быть каналом утечки.
  if (!song || song.visibility === 'private' || !song.coverUrl) {
    return new Response(null, { status: 404 });
  }

  const m = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(song.coverUrl);
  if (!m) return new Response(null, { status: 404 });

  const source = Buffer.from(m[2], 'base64');

  let body: Buffer;
  let type: string;
  try {
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
    body = source;
    type = m[1];
  }

  remember(key, { body, type });
  return respond(body, type);
}

function respond(body: Buffer, type: string) {
  return new Response(new Uint8Array(body), {
    headers: {
      'Content-Type': type,
      'Content-Length': String(body.byteLength),
      // Ссылка версионируется через ?v=, поэтому кэшируем надолго.
      'Cache-Control': 'public, max-age=31536000, immutable',
      // Формат зависит от Accept — CDN обязан учитывать это в ключе кэша.
      Vary: 'Accept',
    },
  });
}
