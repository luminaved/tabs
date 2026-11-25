// Экспорт всех данных приложения в data-export.json.
// Запуск: node scripts/export-data.mjs   (читает текущий DATABASE_URL из .env)
// Дальше: переключить provider/DATABASE_URL на Neon → db push → import-data.mjs.
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'node:fs';

const prisma = new PrismaClient();

const data = {
  users: await prisma.user.findMany(),
  accounts: await prisma.account.findMany(),
  songs: await prisma.song.findMany(),
  annotations: await prisma.annotation.findMany(),
  likes: await prisma.like.findMany(),
  favorites: await prisma.favorite.findMany(),
  setlists: await prisma.setlist.findMany(),
  setlistItems: await prisma.setlistItem.findMany(),
};

writeFileSync('data-export.json', JSON.stringify(data, null, 2));
console.log(
  'Экспортировано:',
  Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])),
);

await prisma.$disconnect();
