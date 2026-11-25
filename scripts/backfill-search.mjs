// Заполняет Song.searchText для уже существующих разборов.
// Запуск: node scripts/backfill-search.mjs   (берёт DATABASE_URL из .env)
//
// Новые и отредактированные песни собирают это поле сами при сохранении
// (normalize() в lib/songs.ts). Скрипт нужен один раз — для строк, созданных
// до появления колонки; повторный запуск безопасен и просто перезапишет то же.
import { PrismaClient } from '@prisma/client';

// Логика повторяет lib/chordpro/searchText.ts (там она покрыта тестами).
// Скрипты в проекте — .mjs без сборки, поэтому TypeScript-модуль напрямую
// не импортируется; при изменении правил очистки поправить надо оба места.
function stripChordPro(body) {
  return body
    .replace(/\{[^}\n]*\}/g, ' ')
    .replace(/\[[^\]\n]*\]/g, '')
    .replace(/%/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSearchText({ title, artist, body }) {
  return [title, artist ?? '', stripChordPro(body)]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const prisma = new PrismaClient();

const songs = await prisma.song.findMany({
  select: { id: true, title: true, artist: true, body: true, searchText: true },
});

let updated = 0;
for (const song of songs) {
  const searchText = buildSearchText(song);
  if (searchText === song.searchText) continue;
  // updatedAt намеренно не трогаем: по нему версионируются ссылки на обложки
  // и строится карта сайта — служебный пересчёт не должен это ворошить.
  await prisma.$executeRaw`UPDATE "Song" SET "searchText" = ${searchText} WHERE "id" = ${song.id}`;
  updated++;
}

console.log(`Разборов всего: ${songs.length}, обновлено: ${updated}`);
await prisma.$disconnect();
