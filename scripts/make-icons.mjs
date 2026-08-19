// Растровые иконки приложения из app/icon.svg.
// Запуск: node scripts/make-icons.mjs
//
// Пересобирать нужно только если поменялся сам app/icon.svg — результат лежит
// в репозитории, чтобы не растрировать картинку на каждой сборке.
//
// ── Почему не хватает одного SVG ────────────────────────────────────────────
//
// Браузеру для вкладки SVG подходит, и он же остаётся фавиконкой. А вот дальше:
//   • iOS для «На экран „Домой“» берёт apple-touch-icon и SVG не понимает;
//   • Android читает иконки из манифеста и хочет PNG заявленных размеров.
//
// ── Почему скругление снимается ─────────────────────────────────────────────
//
// В app/icon.svg у подложки `rx="14"` — это правильно для фавиконки, её никто
// не обрезает. Но iOS и Android накладывают на иконку СВОЮ маску. Если отдать
// уже скруглённую картинку, углы обрежутся дважды: по краям появится тёмная
// кайма от прозрачных уголков. Поэтому здесь подложка разворачивается в полный
// квадрат, а скругляет пусть система.
//
// Замена делается по точной строке и падает, если не нашла: иначе смена
// картинки однажды молча вернула бы двойное скругление.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.join(import.meta.dirname, '..');
const source = await readFile(path.join(root, 'app', 'icon.svg'), 'utf8');

const ROUNDED = 'rx="14"';
if (!source.includes(ROUNDED)) {
  throw new Error(
    `В app/icon.svg больше нет ${ROUNDED} — проверьте, не скруглена ли подложка ` +
      'иначе, и поправьте этот скрипт: системная маска обрежет углы второй раз.',
  );
}
const square = source.replace(ROUNDED, '');

/**
 * Размеры и адресаты.
 *
 * 180 — то, что запрашивает iOS. Лежит в app/, потому что `apple-icon.png` там
 * — соглашение Next: он сам поставит <link rel="apple-touch-icon"> в <head>.
 * 192 и 512 — обычный набор для манифеста; они в public/, а НЕ в app/, иначе
 * Next принял бы их за ещё одну фавиконку (файлы `icon*` в app/ — тоже
 * соглашение) и добавил лишние ссылки в разметку.
 */
const targets = [
  { size: 180, file: path.join(root, 'app', 'apple-icon.png') },
  { size: 192, file: path.join(root, 'public', 'icon-192.png') },
  { size: 512, file: path.join(root, 'public', 'icon-512.png') },
];

for (const { size, file } of targets) {
  // Плотность отсчитывается от собственного размера SVG (64px): без неё sharp
  // растрирует картинку в 64×64 и потом растягивает — получается мыло.
  const density = Math.round(72 * (size / 64));
  await sharp(Buffer.from(square), { density })
    .resize(size, size)
    // Без альфы: прозрачные углы iOS подставляет чёрным, а у нас подложка и так
    // непрозрачная — пусть это будет видно и в файле.
    .flatten({ background: '#0e0d0b' })
    .png({ compressionLevel: 9 })
    .toFile(file);
  console.log(`${path.relative(root, file)}: ${size}×${size}`);
}
