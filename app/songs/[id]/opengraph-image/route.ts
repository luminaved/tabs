import sharp from 'sharp';
import { prisma } from '@/lib/db';
import { getInstrument } from '@/lib/chords/instruments';

/**
 * Картинка для превью ссылки (Telegram/VK/WhatsApp/Twitter) — 1200×630.
 *
 * Обложка кладётся по центру на её же размытую увеличенную копию, сверху —
 * вордмарк. Собирается через sharp, а не через генерацию текста: подписи
 * (название, исполнитель, «разбор») приходят в og:title/og:description и
 * рисуются самим мессенджером — так они читаются лучше и не зависят от
 * наличия кириллического шрифта на сервере.
 */

// Стандартный размер карточки превью. Константы локальные: экспортировать
// size/contentType можно из файла-конвенции opengraph-image, но не из route.ts.
const size = { width: 1200, height: 630 };
// JPEG, а не PNG: на фотографии обложки PNG весит под мегабайт, а мессенджеры
// такие превью тянут долго (или обрезают).
const contentType = 'image/jpeg';

const BG = '#0e0d0b';
const ACCENT = '#e6a23c';

const CACHE_LIMIT = 60;
const cache = new Map<string, Buffer>();

// Вордмарк — латиница, поэтому рисуется одинаково на любой системе (кириллицу
// в картинку принципиально не выводим). Разбивка «Raw» акцентом + «Chords»
// основным цветом повторяет шапку сайта: превью ссылки в мессенджере должно
// узнаваться как та же марка.
const wordmark = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}">
     <text x="60" y="90" font-family="Georgia, 'Times New Roman', serif" font-size="46"
           font-weight="600" fill="#f5efe6"><tspan fill="${ACCENT}">Raw</tspan>Chords</text>
     <text x="60" y="570" font-family="Arial, Helvetica, sans-serif" font-size="28"
           fill="${ACCENT}" opacity="0.95">chords &amp; tabs</text>
   </svg>`,
);

/**
 * Заглушка для разборов без обложки: фирменный фон + грифовый мотив.
 * Число струн — по инструменту (у укулеле их четыре), мотив центрируется.
 */
function placeholder(strings = 6): Buffer {
  const gap = 50;
  const top = 315 - ((strings - 1) * gap) / 2;
  const dots = [0.25, 0.55, 0.4].map((k, i) => ({
    cx: 520 + i * 60,
    cy: top + Math.round((strings - 1) * gap * k),
  }));

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}">
       <defs>
         <radialGradient id="g" cx="50%" cy="0%" r="90%">
           <stop offset="0%" stop-color="#2a2118"/>
           <stop offset="100%" stop-color="${BG}"/>
         </radialGradient>
       </defs>
       <rect width="100%" height="100%" fill="url(#g)"/>
       <g stroke="${ACCENT}" stroke-width="4" stroke-linecap="round" opacity="0.30">
         ${Array.from({ length: strings }, (_, i) => `<path d="M420 ${top + i * gap}h360"/>`).join('')}
       </g>
       <g fill="${ACCENT}">
         ${dots.map((d) => `<circle cx="${d.cx}" cy="${d.cy}" r="14"/>`).join('')}
       </g>
     </svg>`,
  );
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const song = await prisma.song.findUnique({
    where: { id },
    select: { coverUrl: true, visibility: true, updatedAt: true, instrument: true },
  });
  if (!song || song.visibility === 'private') return new Response(null, { status: 404 });

  const strings = getInstrument(song.instrument).strings;

  const key = `${id}:${song.updatedAt.getTime()}`;
  const hit = cache.get(key);
  if (hit) return image(hit);

  const m = song.coverUrl
    ? /^data:image\/[a-z+.-]+;base64,(.+)$/i.exec(song.coverUrl)
    : null;

  let out: Buffer;
  try {
    if (m) {
      const src = Buffer.from(m[1], 'base64');
      // Фон — сильно размытая растянутая обложка, поверх — она же чётко.
      const bg = await sharp(src)
        .resize(size.width, size.height, { fit: 'cover' })
        .blur(48)
        .modulate({ brightness: 0.45 })
        .toBuffer();
      const art = await sharp(src)
        .resize(430, 430, { fit: 'cover' })
        .png()
        .toBuffer();

      out = await sharp(bg)
        .composite([
          { input: art, top: 100, left: Math.round((size.width - 430) / 2) },
          { input: wordmark, top: 0, left: 0 },
        ])
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer();
    } else {
      out = await sharp(placeholder(strings))
        .composite([{ input: wordmark, top: 0, left: 0 }])
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer();
    }
  } catch {
    out = await sharp(placeholder(strings)).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  }

  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, out);
  return image(out);
}

function image(body: Buffer) {
  return new Response(new Uint8Array(body), {
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(body.byteLength),
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
