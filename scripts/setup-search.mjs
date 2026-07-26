// Готовит БД к поиску: расширение pg_trgm + триграммный индекс.
// Запуск: node scripts/setup-search.mjs   (берёт DATABASE_URL из .env)
//
// Индекс GIN по searchText ускоряет и обычный поиск подстроки (LIKE '%…%',
// в который компилируется `contains`), и подбор похожих при опечатке.
// Команды идемпотентны — повторный запуск ничего не ломает.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS pg_trgm');
console.log('расширение pg_trgm: готово');

await prisma.$executeRawUnsafe(
  'CREATE INDEX IF NOT EXISTS "Song_searchText_trgm_idx" ON "Song" USING GIN ("searchText" gin_trgm_ops)',
);
console.log('индекс Song_searchText_trgm_idx: готов');

await prisma.$disconnect();
