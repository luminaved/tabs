import { describe, expect, it } from 'vitest';
import { coverSitemapSrc, coverSrc, coverVersion } from './coverUrl';

const id = 'cmrxly6830002uk40nbilvetz';
const at = new Date('2026-08-01T12:00:00Z');

describe('coverSrc', () => {
  it('версионирует ссылку и несёт размер', () => {
    expect(coverSrc(id, at, 'sm')).toBe(`/covers/${id}?v=${coverVersion(at)}&s=sm`);
  });
});

describe('coverSitemapSrc', () => {
  it('версионирует ссылку — иначе поиск оставил бы себе старую картинку', () => {
    expect(coverSitemapSrc(id, at)).toContain(`?v=${coverVersion(at)}`);
    expect(coverSitemapSrc(id, at)).not.toBe(coverSitemapSrc(id, new Date(0)));
  });

  it('не содержит амперсанда', () => {
    // Не придирка к стилю: Next выводит sitemap.xml подстановкой строк, БЕЗ
    // экранирования, и сырой `&` внутри <image:loc> делает невалидным весь
    // файл — поисковик отбрасывает карту целиком. Отсюда единственный
    // параметр в адресе; если сюда однажды добавят размер, тест это поймает.
    expect(coverSitemapSrc(id, at)).not.toContain('&');
  });
});
