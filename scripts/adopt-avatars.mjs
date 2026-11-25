// Переносит картинки профиля от провайдера входа (Google) к себе в базу.
//
// Запуск:  node --env-file=.env scripts/adopt-avatars.mjs           — показать, что будет
//          node --env-file=.env scripts/adopt-avatars.mjs --apply   — записать
//
// Маршрут /avatars/[id] делает то же самое сам при первом обращении, так что
// скрипт не обязателен — он лишь снимает эту разовую задержку с первого
// посетителя. Повторный запуск безопасен: у кого адрес уже локальный, тех
// пропускаем.
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';

const STORE_SIZE = 256;
const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 8000;
const ALLOWED_HOSTS = ['googleusercontent.com'];

const apply = process.argv.includes('--apply');
const prisma = new PrismaClient();

function allowed(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    return ALLOWED_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, name: true, email: true, image: true } });
  const remote = users.filter((u) => u.image && !u.image.startsWith('data:'));

  console.log(`Всего аккаунтов: ${users.length}`);
  console.log(`С внешней картинкой: ${remote.length}\n`);

  if (remote.length === 0) {
    console.log('Переносить нечего — внешних адресов в базе нет.');
    return;
  }

  for (const u of remote) {
    const who = (u.name || u.email || u.id).slice(0, 32).padEnd(34);
    if (!allowed(u.image)) {
      console.log(`  ${who} ПРОПУСК — хост не в белом списке`);
      continue;
    }
    if (!apply) {
      console.log(`  ${who} будет перенесён`);
      continue;
    }

    try {
      const res = await fetch(u.image, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: 'follow',
        headers: { accept: 'image/*' },
      });
      if (!res.ok) {
        console.log(`  ${who} ОШИБКА — ответ ${res.status}`);
        continue;
      }
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.byteLength > MAX_BYTES) {
        console.log(`  ${who} ПРОПУСК — ${Math.round(bytes.byteLength / 1024)} КБ, слишком много`);
        continue;
      }

      const jpeg = await sharp(bytes)
        .resize(STORE_SIZE, STORE_SIZE, { fit: 'cover' })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();
      const dataUrl = `data:image/jpeg;base64,${jpeg.toString('base64')}`;

      // Только если адрес всё ещё прежний: пользователь мог за это время
      // загрузить своё фото, и затирать его нельзя.
      const { count } = await prisma.user.updateMany({
        where: { id: u.id, image: u.image },
        data: { image: dataUrl },
      });

      console.log(
        count
          ? `  ${who} готово — ${Math.round(bytes.byteLength / 1024)} КБ → ${Math.round(jpeg.byteLength / 1024)} КБ`
          : `  ${who} ПРОПУСК — фото сменилось, пока скрипт работал`,
      );
    } catch (e) {
      console.log(`  ${who} ОШИБКА — ${e.message}`);
    }
  }

  if (!apply) console.log('\nЭто предпросмотр. Чтобы записать, добавьте --apply');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
