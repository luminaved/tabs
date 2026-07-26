import { describe, expect, it } from 'vitest';
import { catalogHref, parseVerifiedParam } from './catalogUrl';

describe('catalogHref', () => {
  it('без параметров — чистый адрес каталога', () => {
    expect(catalogHref('/')).toBe('/');
    expect(catalogHref('/ukulele')).toBe('/ukulele');
  });

  it('значения по умолчанию в адрес не пишутся', () => {
    // Иначе базовый каталог получил бы «/?sort=new» и разошёлся с canonical.
    expect(catalogHref('/', { sort: 'new', verified: false, query: '' })).toBe('/');
  });

  it('поиск, сортировка и отбор попадают в адрес', () => {
    expect(catalogHref('/', { query: 'алина' })).toBe('/?q=%D0%B0%D0%BB%D0%B8%D0%BD%D0%B0');
    expect(catalogHref('/', { sort: 'views' })).toBe('/?sort=views');
    expect(catalogHref('/', { verified: true })).toBe('/?verified=1');
  });

  // Главное свойство: любой переключатель сохраняет остальные параметры.
  it('параметры не теряют друг друга', () => {
    expect(catalogHref('/ukulele', { query: 'дом', sort: 'likes', verified: true })).toBe(
      '/ukulele?q=%D0%B4%D0%BE%D0%BC&sort=likes&verified=1',
    );
  });

  it('спецсимволы в запросе экранируются', () => {
    expect(catalogHref('/', { query: 'a&b=c' })).toBe('/?q=a%26b%3Dc');
  });
});

describe('parseVerifiedParam', () => {
  it('включается только явной единицей', () => {
    expect(parseVerifiedParam('1')).toBe(true);
  });

  it('всё остальное — выключено', () => {
    expect(parseVerifiedParam(undefined)).toBe(false);
    expect(parseVerifiedParam(null)).toBe(false);
    expect(parseVerifiedParam('')).toBe(false);
    expect(parseVerifiedParam('0')).toBe(false);
    expect(parseVerifiedParam('true')).toBe(false);
    expect(parseVerifiedParam('да')).toBe(false);
  });
});
