// Импорт data-export.json в текущую БД (напр. в Neon после db push).
// Запуск: node scripts/import-data.mjs
// Порядок вставки учитывает внешние ключи. Идемпотентно (skipDuplicates).
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';

const prisma = new PrismaClient();
const data = JSON.parse(readFileSync('data-export.json', 'utf8'));

// Порядок важен из-за внешних ключей.
const steps = [
  ['users', prisma.user],
  ['accounts', prisma.account],
  ['songs', prisma.song],
  ['annotations', prisma.annotation],
  ['likes', prisma.like],
  ['favorites', prisma.favorite],
  ['setlists', prisma.setlist],
  ['setlistItems', prisma.setlistItem],
];

for (const [key, model] of steps) {
  const rows = data[key] ?? [];
  if (rows.length === 0) continue;
  const res = await model.createMany({ data: rows, skipDuplicates: true });
  console.log(`${key}: +${res.count}`);
}

console.log('Импорт завершён.');
await prisma.$disconnect();
