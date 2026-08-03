import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { telegramCheckString, verifyTelegramAuth, telegramDisplayName } from './telegram';

const BOT = '123456:AAHfake-token-for-tests';

/** Подписывает данные так же, как это делает Telegram. */
function sign(data: Record<string, string>, token = BOT): Record<string, string> {
  const secret = createHash('sha256').update(token).digest();
  const hash = createHmac('sha256', secret).update(telegramCheckString(data)).digest('hex');
  return { ...data, hash };
}

const now = new Date('2026-08-02T12:00:00Z');
const fresh = () => String(Math.floor(now.getTime() / 1000) - 60);

const base = () => ({
  id: '4242',
  first_name: 'Юрий',
  username: 'yura',
  auth_date: fresh(),
});

describe('telegramCheckString', () => {
  it('сортирует поля по имени и склеивает переводом строки', () => {
    expect(telegramCheckString({ b: '2', a: '1', c: '3' })).toBe('a=1\nb=2\nc=3');
  });

  it('исключает сам hash', () => {
    expect(telegramCheckString({ a: '1', hash: 'deadbeef' })).toBe('a=1');
  });

  it('пропускает пустые и отсутствующие поля', () => {
    expect(telegramCheckString({ a: '1', b: '', c: undefined })).toBe('a=1');
  });
});

describe('verifyTelegramAuth', () => {
  it('принимает честно подписанные данные', () => {
    const r = verifyTelegramAuth(sign(base()), BOT, now);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.profile.id).toBe('4242');
      expect(r.profile.username).toBe('yura');
    }
  });

  it('отвергает подделку: поле изменили после подписи', () => {
    // Главный сценарий: человек честно вошёл своим аккаунтом и подменил id на
    // чужой. Без проверки подписи это был бы вход под кем угодно.
    const forged = { ...sign(base()), id: '9999' };
    expect(verifyTelegramAuth(forged, BOT, now)).toEqual({ ok: false, reason: 'bad-signature' });
  });

  it('отвергает подпись от другого бота', () => {
    const alien = sign(base(), '999:another-bot');
    expect(verifyTelegramAuth(alien, BOT, now)).toEqual({ ok: false, reason: 'bad-signature' });
  });

  it('отвергает добавленное поле, которого не было в подписи', () => {
    const extra = { ...sign(base()), photo_url: 'https://evil.example/x.jpg' };
    expect(verifyTelegramAuth(extra, BOT, now)).toEqual({ ok: false, reason: 'bad-signature' });
  });

  it('отвергает просроченное — защита от повторной отправки', () => {
    const old = sign({ ...base(), auth_date: String(Math.floor(now.getTime() / 1000) - 90000) });
    expect(verifyTelegramAuth(old, BOT, now)).toEqual({ ok: false, reason: 'expired' });
  });

  it('отвергает дату из будущего', () => {
    const ahead = sign({ ...base(), auth_date: String(Math.floor(now.getTime() / 1000) + 3600) });
    expect(verifyTelegramAuth(ahead, BOT, now)).toEqual({ ok: false, reason: 'expired' });
  });

  it('небольшое расхождение часов допускает', () => {
    const skew = sign({ ...base(), auth_date: String(Math.floor(now.getTime() / 1000) + 60) });
    expect(verifyTelegramAuth(skew, BOT, now).ok).toBe(true);
  });

  it('отвергает мусор в обязательных полях', () => {
    const bad = (patch: Record<string, string>) =>
      verifyTelegramAuth({ ...sign(base()), ...patch }, BOT, now);
    expect(bad({ id: '12e5' }).ok).toBe(false);
    expect(bad({ id: '' }).ok).toBe(false);
    expect(bad({ auth_date: 'вчера' }).ok).toBe(false);
    expect(bad({ hash: 'нет' }).ok).toBe(false);
  });

  it('без токена бота не пропускает никого', () => {
    // Иначе незаданная переменная окружения превратилась бы в открытую дверь.
    expect(verifyTelegramAuth(sign(base()), '', now)).toEqual({ ok: false, reason: 'malformed' });
  });
});

describe('telegramDisplayName', () => {
  const p = (o: Partial<Record<string, string>>) =>
    ({ id: '1', auth_date: '1', hash: 'x', ...o }) as never;

  it('предпочитает имя с фамилией', () => {
    expect(telegramDisplayName(p({ first_name: 'Юрий', last_name: 'Гринев' }))).toBe('Юрий Гринев');
  });

  it('падает на username, если имени нет', () => {
    expect(telegramDisplayName(p({ username: 'yura' }))).toBe('yura');
  });

  it('без всего — null, а не пустая строка', () => {
    expect(telegramDisplayName(p({}))).toBeNull();
  });
});
