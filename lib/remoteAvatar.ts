import sharp from 'sharp';
import { prisma } from './db';
import { isAllowedAvatarUrl } from './imageInput';

/**
 * Перенос картинки профиля от провайдера входа к себе.
 *
 * Auth.js кладёт в `User.image` внешний адрес (googleusercontent.com), и раньше
 * браузер посетителя шёл за картинкой туда. Это была единственная сторонняя
 * загрузка на сайте: где Google режется — аватары не грузились, а чужой сервер
 * видел адреса всех, кто открыл профиль.
 *
 * Скачиваем ОДИН раз и сохраняем в `User.image` как data URL — ровно в том же
 * виде, в каком лежит загруженное пользователем фото. После этого внешний адрес
 * из базы исчезает, и Google не участвует ни на сервере, ни в браузере.
 *
 * Почему разово, а не проксированием на каждый запрос: проксирование оставляло
 * поход наружу на первом обращении (замерено ~1.2 с) и держало зависимость от
 * доступности Google навсегда. Здесь эта цена платится единожды за аккаунт.
 */

/** Тот же размер, что даёт загрузка своего фото (AvatarInput). */
const STORE_SIZE = 256;
const STORE_QUALITY = 0.85;
/** Аватар в пару сотен пикселей столько не весит — всё сверх этого подозрительно. */
const MAX_BYTES = 2 * 1024 * 1024;
/** Дольше ждать нечего: аватар не настолько важен, чтобы задерживать страницу. */
const TIMEOUT_MS = 4000;

/**
 * Одновременные запросы к одному и тому же новому аватару не должны каждый
 * лезть наружу: шапка есть на всех страницах, и первое появление пользователя
 * легко даёт пачку параллельных обращений. Держим один поход на аккаунт.
 */
const inFlight = new Map<string, Promise<string | null>>();

/**
 * Скачивает внешнюю картинку, ужимает и сохраняет в базу как data URL.
 * Возвращает этот data URL либо null, если не вышло (тогда вызывающий код
 * просто обходится тем, что есть).
 */
export function adoptRemoteAvatar(userId: string, url: string): Promise<string | null> {
  const running = inFlight.get(userId);
  if (running) return running;

  const task = run(userId, url).finally(() => inFlight.delete(userId));
  inFlight.set(userId, task);
  return task;
}

async function run(userId: string, url: string): Promise<string | null> {
  // Белый список проверяется здесь, а не только у вызывающего: адрес приходит
  // из базы, и без проверки этот код стал бы способом слать запросы куда угодно
  // от имени сервера.
  if (!isAllowedAvatarUrl(url)) return null;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'follow',
      headers: { accept: 'image/*' },
    });
    if (!res.ok) return null;
    if (!(res.headers.get('content-type') ?? '').startsWith('image/')) return null;

    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) return null;

    const jpeg = await sharp(bytes)
      .resize(STORE_SIZE, STORE_SIZE, { fit: 'cover' })
      .jpeg({ quality: Math.round(STORE_QUALITY * 100), mozjpeg: true })
      .toBuffer();

    const dataUrl = `data:image/jpeg;base64,${jpeg.toString('base64')}`;

    // Пишем только если в базе всё ещё тот же внешний адрес: пользователь мог
    // за это время загрузить своё фото, и затирать его нельзя.
    await prisma.user.updateMany({
      where: { id: userId, image: url },
      data: { image: dataUrl },
    });

    return dataUrl;
  } catch {
    // Недоступен, оборвался, не уложился в таймаут, картинка битая.
    return null;
  }
}
