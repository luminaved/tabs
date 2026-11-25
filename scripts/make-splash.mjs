// Стартовые картинки для iOS («apple-touch-startup-image») из app/icon.svg.
// Запуск: node scripts/make-splash.mjs
//
// Пересобирать нужно, если поменялся app/icon.svg, фон темы или список
// устройств в lib/appleSplashDevices.json. Результат лежит в репозитории —
// растрировать три десятка картинок на каждой сборке незачем.
//
// ── Зачем это вообще ────────────────────────────────────────────────────────
//
// Пока ярлыка на домашнем экране не было, вопрос не стоял. Теперь при запуске
// iOS показывает заставку, и если её не дать — рисует белый экран. На тёмном
// сайте это вспышка в лицо, да ещё и не своим цветом.
//
// ── Почему по картинке на каждое устройство ─────────────────────────────────
//
// Так требует iOS: заставка подхватывается, только если её размер совпадает с
// экраном ТОЧНО, пиксель в пиксель. Не совпал — заставки нет, снова белое.
// Поэтому таблица экранов и лежит отдельным файлом, общим с разметкой.
//
// ── Почему без анимации ─────────────────────────────────────────────────────
//
// Заставка на iOS — статичная картинка, это ограничение системы: ни HTML, ни
// CSS, ни GIF туда не положить. Всё живое начинается уже в самом приложении.
import { readFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.join(import.meta.dirname, '..');
const outDir = path.join(root, 'public', 'splash');

/** Фон — --color-bg из app/globals.css. Разъедутся — заставка будет мигать. */
const BG = '#0e0d0b';

/**
 * Размер значка на заставке, в css-пикселях (в файле умножается на плотность).
 * Одно число на все устройства: так значок выглядит одинаково и на маленьком
 * телефоне, и на планшете. Считать долей от экрана нельзя — на iPad вышел бы
 * герб во весь лист.
 */
const MARK_CSS = 120;

const { devices } = JSON.parse(
  await readFile(path.join(root, 'lib', 'appleSplashDevices.json'), 'utf8'),
);

// Значок берём как есть, вместе с подложкой: её цвет совпадает с фоном
// заставки, поэтому скруглённый квадрат на ней не виден и на экране остаётся
// просто знак на тёмном. Скруглять или вырезать подложку отдельно не нужно —
// в отличие от иконок приложения, эту картинку система ничем не маскирует.
const markSvg = await readFile(path.join(root, 'app', 'icon.svg'), 'utf8');

// Каталог пересоздаём: если из таблицы убрали устройство, его картинка не
// должна остаться лежать в репозитории навсегда.
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

/** Имя файла — оно же собирается в разметке, см. splashFileName там. */
function fileName(width, height, dpr, orientation) {
  return `${width}x${height}@${dpr}x-${orientation}.png`;
}

let count = 0;
for (const device of devices) {
  const markPx = Math.round(MARK_CSS * device.dpr);
  // Плотность от собственного размера SVG (64px) — иначе sharp растрирует его
  // в 64×64 и растянет, и на заставке будет ровно то мыло, от которого уходим.
  const mark = await sharp(Buffer.from(markSvg), { density: Math.round(72 * (markPx / 64)) })
    .resize(markPx, markPx)
    .png()
    .toBuffer();

  for (const orientation of ['portrait', 'landscape']) {
    const w = device.width * device.dpr;
    const h = device.height * device.dpr;
    const [pxW, pxH] = orientation === 'portrait' ? [w, h] : [h, w];

    await sharp({ create: { width: pxW, height: pxH, channels: 3, background: BG } })
      .composite([{ input: mark, gravity: 'centre' }])
      // Палитра вместо полного цвета: заставка — это заливка и маленький
      // значок, в 256 цветов она укладывается с запасом, а весит вдесятеро
      // меньше. Иначе одна картинка iPad Pro тянула бы на пару мегабайт.
      .png({ compressionLevel: 9, palette: true })
      .toFile(path.join(outDir, fileName(device.width, device.height, device.dpr, orientation)));
    count++;
  }
}

console.log(`public/splash: ${count} картинок для ${devices.length} экранов`);
