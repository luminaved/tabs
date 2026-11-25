import { describe, expect, it } from 'vitest';
import { slugify, songPath, songIdFromParam } from './slug';

describe('slugify', () => {
  it('транслитерирует кириллицу', () => {
    expect(slugify('Звезда по имени Солнце')).toBe('zvezda-po-imeni-solnce');
    expect(slugify('Ёжик')).toBe('ezhik');
    expect(slugify('Щастя')).toBe('schastya');
  });

  it('выбрасывает знаки препинания и схлопывает разделители', () => {
    expect(slugify('  «Кукушка» (акустика)!!!  ')).toBe('kukushka-akustika');
    expect(slugify('Rock-n-Roll   Star')).toBe('rock-n-roll-star');
  });

  it('снимает диакритику с латиницы, а не режет слово', () => {
    expect(slugify('Café del Mar')).toBe('cafe-del-mar');
  });

  it('сохраняет цифры', () => {
    expect(slugify('17 ножевых')).toBe('17-nozhevyh');
  });

  it('на строке без латиницы и кириллицы отдаёт пустоту', () => {
    expect(slugify('!!! ??? ...')).toBe('');
    expect(slugify('')).toBe('');
  });

  it('обрезает длинную подпись по границе слова', () => {
    const long = slugify('a'.repeat(20) + ' ' + 'b'.repeat(20) + ' ' + 'c'.repeat(30));
    expect(long.length).toBeLessThanOrEqual(60);
    // Обрубков быть не должно: последнее слово либо целое, либо его нет.
    for (const word of long.split('-')) {
      expect(['a'.repeat(20), 'b'.repeat(20), 'c'.repeat(30)]).toContain(word);
    }
  });

  it('не оставляет дефис на конце', () => {
    expect(slugify('Песня —')).toBe('pesnya');
  });
});

describe('songPath', () => {
  const id = 'cmrxly6830002uk40nbilvetz';

  it('ставит название перед исполнителем', () => {
    expect(songPath({ id, title: '17 ножевых', artist: 'CUPSIZE' })).toBe(
      `/songs/17-nozhevyh-cupsize-${id}`,
    );
  });

  it('обходится без исполнителя', () => {
    expect(songPath({ id, title: 'Кукушка', artist: null })).toBe(`/songs/kukushka-${id}`);
  });

  it('без пригодной подписи отдаёт прежний адрес', () => {
    expect(songPath({ id, title: '???', artist: null })).toBe(`/songs/${id}`);
  });
});

describe('songIdFromParam', () => {
  const id = 'cmrxly6830002uk40nbilvetz';

  it('достаёт идентификатор из подписанного адреса', () => {
    expect(songIdFromParam(`17-nozhevyh-cupsize-${id}`)).toBe(id);
  });

  it('пропускает голый идентификатор как есть (старые ссылки)', () => {
    expect(songIdFromParam(id)).toBe(id);
  });

  it('переживает закодированный сегмент', () => {
    expect(songIdFromParam(encodeURIComponent(`песня-${id}`))).toBe(id);
  });

  it('обратна songPath для любых названий', () => {
    for (const title of ['Кукушка', '17 ножевых', '???', 'Café — del Mar!']) {
      const path = songPath({ id, title, artist: 'Кино' });
      expect(songIdFromParam(path.slice('/songs/'.length))).toBe(id);
    }
  });
});
