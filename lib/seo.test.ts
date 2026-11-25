import { describe, expect, it } from 'vitest';
import {
  catalogCanonical,
  catalogCanonicalIsSafe,
  catalogMetadata,
  songSeoDescription,
  songSeoTitle,
} from './seo';
import { INSTRUMENTS } from './chords/instruments';

const guitar = INSTRUMENTS.guitar;
const ukulele = INSTRUMENTS.ukulele;

/** Индексируется ли страница по собранным метаданным. */
function indexed(meta: ReturnType<typeof catalogMetadata>): boolean {
  // `robots` появляется в объекте ТОЛЬКО у отобранной выдачи; отсутствие поля
  // означает «индексируем» (значение по умолчанию из корневого layout).
  const robots = (meta as { robots?: { index: boolean } }).robots;
  return robots === undefined || robots.index;
}

describe('catalogCanonical', () => {
  it('чистый каталог указывает сам на себя', () => {
    expect(catalogCanonical('/', {})).toBe('/');
    expect(catalogCanonical('/ukulele', {})).toBe('/ukulele');
  });

  it('страница пагинации имеет СВОЙ canonical, а не первой страницы', () => {
    // Указать здесь «/» — значит объявить вторую страницу копией первой, и
    // поисковик перестанет заходить вглубь каталога.
    expect(catalogCanonical('/ukulele', { page: '2' })).toBe('/ukulele?page=2');
  });

  it('отобранная выдача склеивается с чистым каталогом', () => {
    expect(catalogCanonical('/', { q: 'кино' })).toBe('/');
    expect(catalogCanonical('/', { verified: '1' })).toBe('/');
    expect(catalogCanonical('/', { sort: 'views' })).toBe('/');
  });

  it('sort=new — не отбор: это порядок по умолчанию', () => {
    expect(catalogCanonical('/ukulele', { sort: 'new' })).toBe('/ukulele');
    expect(catalogCanonical('/ukulele', { sort: 'new', page: '3' })).toBe('/ukulele?page=3');
  });
});

describe('catalogMetadata: robots', () => {
  it('чистый каталог индексируется', () => {
    expect(indexed(catalogMetadata(guitar, '/', {}))).toBe(true);
  });

  it('страницы пагинации ОСТАЮТСЯ в индексе', () => {
    // noindex здесь со временем обесценил бы ссылки на разборы вглубь каталога.
    expect(indexed(catalogMetadata(guitar, '/', { page: '2' }))).toBe(true);
    expect(indexed(catalogMetadata(guitar, '/', { page: '7' }))).toBe(true);
  });

  it('поиск и отбор из индекса уходят', () => {
    expect(indexed(catalogMetadata(guitar, '/', { q: 'кино' }))).toBe(false);
    expect(indexed(catalogMetadata(guitar, '/', { verified: '1' }))).toBe(false);
    expect(indexed(catalogMetadata(guitar, '/', { sort: 'views' }))).toBe(false);
    expect(indexed(catalogMetadata(guitar, '/', { sort: 'likes' }))).toBe(false);
  });

  it('?sort=new НЕ выкидывает каталог из индекса', () => {
    // Это та же выдача, что и чистый «/», — просто порядок назван явно.
    // Проверка на наличие параметра (как было) уводила в noindex главную.
    expect(indexed(catalogMetadata(guitar, '/', { sort: 'new' }))).toBe(true);
    expect(indexed(catalogMetadata(ukulele, '/ukulele', { sort: 'new' }))).toBe(true);
  });

  it('мусор в sort приравнивается к умолчанию, а не к отбору', () => {
    expect(indexed(catalogMetadata(guitar, '/', { sort: 'нет-такой' }))).toBe(true);
    expect(indexed(catalogMetadata(guitar, '/', { sort: '' }))).toBe(true);
  });

  it('пустой поиск отбором не считается', () => {
    expect(indexed(catalogMetadata(guitar, '/', { q: '   ' }))).toBe(true);
  });
});

describe('catalogMetadata: заголовок', () => {
  it('страницы со второй подписаны по-разному', () => {
    const first = catalogMetadata(guitar, '/', {}).title;
    const second = catalogMetadata(guitar, '/', { page: '2' }).title;
    expect(second).not.toBe(first);
    expect(second).toContain('2');
  });

  it('?sort=new не меняет заголовок первой страницы', () => {
    expect(catalogMetadata(guitar, '/', { sort: 'new' }).title).toBe(
      catalogMetadata(guitar, '/', {}).title,
    );
  });
});

describe('catalogCanonicalIsSafe', () => {
  it('адрес с query в корне Next исказил бы — такой тег не выводим', () => {
    expect(catalogCanonicalIsSafe('/?page=2')).toBe(false);
  });

  it('обычные адреса выводятся как есть', () => {
    expect(catalogCanonicalIsSafe('/')).toBe(true);
    expect(catalogCanonicalIsSafe('/ukulele')).toBe(true);
    expect(catalogCanonicalIsSafe('/ukulele?page=2')).toBe(true);
  });
});

describe('songSeoTitle', () => {
  it('название идёт первым — оно должно пережить обрезку в выдаче', () => {
    const title = songSeoTitle({ title: 'Тёплый вечер', artist: 'Демо' }, guitar);
    expect(title.startsWith('Тёплый вечер')).toBe(true);
    expect(title).toContain('Демо');
    expect(title).toContain('аккорды');
  });

  it('без исполнителя лишнего тире нет', () => {
    expect(songSeoTitle({ title: 'Без имени' }, guitar)).not.toContain('—  ');
  });

  it('инструмент назван — «аккорды на укулеле» ищут именно так', () => {
    expect(songSeoTitle({ title: 'X' }, ukulele)).toContain('укулеле');
  });
});

describe('songSeoDescription', () => {
  it('капо называется, только когда оно у разбора есть', () => {
    // Раньше «и капо» стояло в описании КАЖДОГО разбора, хотя капо не было
    // нигде: ни поля в редакторе, ни строки на странице.
    expect(songSeoDescription({ title: 'X', capo: 3 }, guitar)).toContain('3 ладу');
    expect(songSeoDescription({ title: 'X', capo: 0 }, guitar)).not.toContain('апо');
    expect(songSeoDescription({ title: 'X' }, guitar)).not.toContain('апо');
  });

  it('тональность добавляется только заданная', () => {
    expect(songSeoDescription({ title: 'X', key: 'Am' }, guitar)).toContain('Тональность: Am.');
    expect(songSeoDescription({ title: 'X' }, guitar)).not.toContain('Тональность');
  });

  it('лишних двойных пробелов не остаётся', () => {
    const text = songSeoDescription({ title: 'X', artist: null, key: null, capo: 0 }, guitar);
    expect(text).not.toContain('  ');
  });
});
