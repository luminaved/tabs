import bcrypt from 'bcryptjs';

/**
 * Стоимость bcrypt.
 *
 * `bcryptjs` — реализация на чистом JS, она в 2–4 раза медленнее нативной: на
 * 12 раундах один хеш занимал здесь ~750 мс. Столько же тратит КАЖДАЯ попытка
 * входа, в том числе неудачная, и на однопоточном Node это превращалось в
 * рычаг: десяток параллельных запросов на /login забивал event loop и клал
 * весь сайт.
 *
 * 10 раундов — ~190 мс, всё ещё выше типовой рекомендации для bcrypt и заметно
 * дороже перебора. Число зашито в сам хеш, поэтому старые пароли на 12 раундах
 * продолжают проверяться как ни в чём не бывало — перевыпускать ничего не надо.
 * Нужна прежняя стоимость — берите нативный биндинг (@node-rs/bcrypt) или argon2.
 */
const ROUNDS = 10;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
