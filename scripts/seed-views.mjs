// Поднимает Song.viewCount до 1.5–2× от числа лайков.
//
// Запуск:  node scripts/seed-views.mjs           — только показать, что будет
//          node scripts/seed-views.mjs --apply   — записать в БД
//
// Множитель у каждого разбора свой (случайный в диапазоне), иначе ряд чисел
// выглядит явной арифметикой от лайков.
//
// Счётчик только ПОВЫШАЕТСЯ: берётся max(текущий, цель). Так засчитанные
// настоящие просмотры не затираются, а разборы без лайков остаются как есть —
// иначе цель 0 обнулила бы им реальные цифры.
//
// Учтите: viewCount — денормализованный счётчик, и после этого он перестаёт
// совпадать с числом записей View. На чтение это не влияет (страница разбора и
// каталог берут именно viewCount), но «Популярные» после накрутки ранжируют
// уже не по настоящему трафику.
import { PrismaClient } from '@prisma/client';

const MIN_FACTOR = 1.5;
const MAX_FACTOR = 2.0;

const apply = process.argv.includes('--apply');
const prisma = new PrismaClient();

const factor = () => MIN_FACTOR + Math.random() * (MAX_FACTOR - MIN_FACTOR);

async function main() {
  const songs = await prisma.song.findMany({
    select: {
      id: true,
      title: true,
      artist: true,
      viewCount: true,
      updatedAt: true,
      _count: { select: { likes: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const planned = [];
  for (const song of songs) {
    const likes = song._count.likes;
    const target = Math.round(likes * factor());
    const next = Math.max(song.viewCount, target);
    if (next !== song.viewCount) {
      planned.push({ ...song, likes, next });
    }
  }

  console.log(`Разборов всего: ${songs.length}`);
  console.log(`Будет изменено: ${planned.length}\n`);

  for (const p of planned) {
    const name = `${p.title}${p.artist ? ` — ${p.artist}` : ''}`;
    console.log(
      `  ${name.slice(0, 42).padEnd(44)} лайков ${String(p.likes).padStart(3)}` +
        `   просмотры ${String(p.viewCount).padStart(4)} → ${p.next}`,
    );
  }

  const untouched = songs.length - planned.length;
  if (untouched > 0) {
    console.log(
      `\nБез изменений: ${untouched} — у них либо нет лайков, либо просмотров уже больше цели.`,
    );
  }

  if (!apply) {
    console.log('\nЭто предпросмотр. Чтобы записать, добавьте --apply');
    return;
  }

  // Пишем по одному: строк немного, а батч ради этого усложнил бы скрипт.
  for (const p of planned) {
    await prisma.song.update({
      where: { id: p.id },
      // updatedAt переносим прежний: накрутка счётчика — не правка разбора, и
      // она не должна выбрасывать песню наверх списков и менять карту сайта.
      data: { viewCount: p.next, updatedAt: p.updatedAt },
    });
  }
  console.log(`\nГотово: обновлено ${planned.length}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
