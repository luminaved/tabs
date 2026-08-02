import { describe, expect, it } from 'vitest';
import {
  AVATAR_TAIL_CHARS,
  avatarSrc,
  avatarVersion,
  avatarVersionFromParts,
} from './avatarUrl';

/** data URL примерно как настоящий аватар (256px JPEG — десятки килобайт). */
function dataUrl(bytes: number, fill = 0x41): string {
  return `data:image/jpeg;base64,${Buffer.alloc(bytes, fill).toString('base64')}`;
}

describe('avatarVersion', () => {
  /**
   * Главное свойство всей затеи: шапка считает версию по `length` и `right`
   * из БД, а маршрут /avatars/[id] — по картинке целиком. Разъедься они, и
   * ссылка в разметке перестала бы совпадать с ключом кэша маршрута: браузер
   * мимо кэша, sharp заново на каждый запрос.
   */
  it('совпадает с расчётом по длине и хвосту', () => {
    for (const url of [dataUrl(20 * 1024), dataUrl(1), dataUrl(200), 'https://lh3.googleusercontent.com/a/ACg8ocK=s96-c']) {
      expect(avatarVersionFromParts(url.length, url.slice(-AVATAR_TAIL_CHARS))).toBe(
        avatarVersion(url),
      );
    }
  });

  it('короче хвоста — тоже совпадает', () => {
    // `right(s, 128)` в Postgres и `slice(-128)` в JS одинаково отдают строку
    // целиком, если она короче.
    const short = 'data:image/jpeg;base64,QUFB';
    expect(short.length).toBeLessThan(AVATAR_TAIL_CHARS);
    expect(avatarVersionFromParts(short.length, short)).toBe(avatarVersion(short));
  });

  it('другая картинка — другая версия', () => {
    expect(avatarVersion(dataUrl(20 * 1024, 0x41))).not.toBe(
      avatarVersion(dataUrl(20 * 1024, 0x42)),
    );
    // Разная длина при одинаковом хвосте тоже обязана расходиться.
    expect(avatarVersion(dataUrl(20 * 1024))).not.toBe(avatarVersion(dataUrl(21 * 1024)));
  });

  it('та же картинка — та же версия', () => {
    expect(avatarVersion(dataUrl(4096))).toBe(avatarVersion(dataUrl(4096)));
  });

  it('версия годится для адреса: только буквы и цифры', () => {
    expect(avatarVersion(dataUrl(4096))).toMatch(/^[a-z0-9]+$/);
  });
});

describe('avatarSrc', () => {
  it('ведёт на свой маршрут с версией', () => {
    expect(avatarSrc('u1', 'abc')).toBe('/avatars/u1?v=abc');
  });
});
