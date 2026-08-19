// Заполняет Song.chords для уже существующих разборов.
// Запуск:  node scripts/backfill-chords.mjs           — только показать, что будет
//          node scripts/backfill-chords.mjs --apply   — записать
//
// Новые и отредактированные песни собирают колонку сами при сохранении
// (normalize() в lib/songs.ts). Скрипт нужен один раз — для строк, созданных до
// появления колонки; повторный запуск безопасен и просто перезапишет то же.
//
// ── Порядок действий и почему он такой ──────────────────────────────────────
//
// DATABASE_URL в .env указывает на ТУ ЖЕ базу, которой пользуется работающий
// сайт, а новый код живёт на машине, пока его не отправили в main. Отсюда
// порядок:
//
//   1) npm run db:push            — добавляет колонку. Старый код о ней не
//                                   знает и не читает, поэтому сайту всё равно.
//   2) node scripts/backfill-chords.mjs --apply
//   3) деплой
//
// Если выкатить код раньше шага 1 — запросы списков упадут на отсутствующей
// колонке. Если раньше шага 2 — страницы останутся целы, но чипы аккордов в
// списках временно пропадут. Сухой прогон по умолчанию — чтобы неверный
// порядок не стоил ничего: без --apply скрипт не пишет ни строки.
//
// Читает он только `body`, поэтому сухой прогон работает и ДО шага 1.
import { PrismaClient, Prisma } from '@prisma/client';

// Логика повторяет chordsInOrder из lib/chordpro/usedChords.ts (там она покрыта
// тестами). Скрипты в проекте — .mjs без сборки, поэтому TypeScript-модуль
// напрямую не импортируется; при изменении разбора поправить надо оба места.
function chordsInOrder(body) {
  const seen = new Set();
  const out = [];
  for (const m of body.matchAll(/\[([^\]]+)\]/g)) {
    const chord = m[1].trim();
    if (chord && !seen.has(chord)) {
      seen.add(chord);
      out.push(chord);
    }
  }
  return out;
}

const apply = process.argv.includes('--apply');
const prisma = new PrismaClient();

const songs = await prisma.song.findMany({ select: { id: true, title: true, body: true } });

let written = 0;
let empty = 0;
for (const song of songs) {
  const chords = chordsInOrder(song.body);
  if (chords.length === 0) empty++;

  if (!apply) {
    console.log(`  ${song.title}: ${chords.length} аккорд(ов)`);
    continue;
  }

  // Массив собираем через Prisma.join, а не подстановкой JS-массива: у text[]
  // формат литерала свой, и полагаться на то, как драйвер угадает тип, здесь
  // незачем — см. прочие грабли сырого SQL в этом проекте.
  const value = chords.length
    ? Prisma.sql`ARRAY[${Prisma.join(chords)}]::text[]`
    : Prisma.sql`ARRAY[]::text[]`;
  // updatedAt намеренно не трогаем (потому и сырой SQL, а не prisma.song.update
  // с его @updatedAt): по нему версионируются ссылки на обложки и строится
  // карта сайта — служебный пересчёт не должен это ворошить.
  await prisma.$executeRaw`UPDATE "Song" SET "chords" = ${value} WHERE "id" = ${song.id}`;
  written++;
}

console.log(
  apply
    ? `Разборов всего: ${songs.length}, записано: ${written}, без аккордов: ${empty}`
    : `Разборов всего: ${songs.length}, без аккордов: ${empty}. ` +
        `Сухой прогон — ничего не записано, добавьте --apply.`,
);
await prisma.$disconnect();
