import { describe, expect, it } from 'vitest';
import { catalogHref, parseCatalogPage, parseVerifiedParam } from './catalogUrl';

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

  it('первая страница в адрес не пишется', () => {
    // Иначе «/» и «/?page=1» — два адреса одной выдачи.
    expect(catalogHref('/', { page: 1 })).toBe('/');
    expect(catalogHref('/', { page: 0 })).toBe('/');
    expect(catalogHref('/', { page: undefined })).toBe('/');
  });

  it('страница со второй попадает в адрес и уживается с отбором', () => {
    expect(catalogHref('/', { page: 2 })).toBe('/?page=2');
    expect(catalogHref('/ukulele', { sort: 'views', verified: true, page: 3 })).toBe(
      '/ukulele?sort=views&verified=1&page=3',
    );
  });
});

describe('parseCatalogPage', () => {
  it('считает с единицы', () => {
    expect(parseCatalogPage('2')).toBe(2);
    expect(parseCatalogPage('1')).toBe(1);
  });

  it('мусор и выход за границы — это первая страница', () => {
    expect(parseCatalogPage(undefined)).toBe(1);
    expect(parseCatalogPage(null)).toBe(1);
    expect(parseCatalogPage('')).toBe(1);
    expect(parseCatalogPage('abc')).toBe(1);
    expect(parseCatalogPage('0')).toBe(1);
    expect(parseCatalogPage('-5')).toBe(1);
  });

  it('дробное усекается', () => {
    expect(parseCatalogPage('3.9')).toBe(3);
  });

  it('упирается в потолок, а не листает БД сколь угодно далеко', () => {
    expect(parseCatalogPage('999999')).toBe(200);
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
