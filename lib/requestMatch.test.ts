import { describe, expect, it } from 'vitest';
import { buildSongIndex, findSongForRequest, looseKey, type MatchSong } from './requestMatch';

const song = (
  id: string,
  title: string,
  artist: string | null,
  instrument = 'guitar',
): MatchSong => ({ id, title, artist, instrument });

const find = (
  songs: MatchSong[],
  req: { title: string; artist: string | null; instrument?: string },
) => findSongForRequest(buildSongIndex(songs), { instrument: 'guitar', ...req })?.id ?? null;

describe('looseKey', () => {
  it('не зависит от регистра, пунктуации, пробелов и дефисов', () => {
    const base = looseKey('В пустоте');
    expect(looseKey('впустоте')).toBe(base);
    expect(looseKey('  В   ПУСТОТЕ! ')).toBe(base);
    expect(looseKey('в-пустоте')).toBe(base);
  });

  it('ё и е — одно и то же', () => {
    expect(looseKey('Самолёты')).toBe(looseKey('самолеты'));
  });

  it('невидимые различия: неразрывный пробел и разложенное «й»', () => {
    expect(looseKey('Тривога и паничка')).toBe(looseKey('Тривога и паничка'));
    // «й» как «и» + комбинирующая краткая (так приходит вставка с некоторых клавиатур).
    expect(looseKey('Киной')).toBe(looseKey('Киной'));
  });

  it('название без латиницы и кириллицы не вырождается в пустую основу', () => {
    expect(looseKey('!!!')).not.toBe('');
    expect(looseKey('!!!')).not.toBe(looseKey('???'));
  });
});

describe('автосвязь заявки с разбором', () => {
  it('«Тривога и паничка / Впустоте» находит разбор, записанный с маленькой буквы', () => {
    const songs = [song('s1', 'тривога и паничка', 'впустоте')];
    expect(find(songs, { title: 'Тривога и паничка', artist: 'Впустоте' })).toBe('s1');
  });

  it('работает и в обратную сторону: заявка маленькими, разбор с заглавных', () => {
    const songs = [song('s1', 'Тривога и паничка', 'Впустоте')];
    expect(find(songs, { title: 'тривога и паничка', artist: 'впустоте' })).toBe('s1');
  });

  it('терпит разное написание исполнителя по пробелам', () => {
    const songs = [song('s1', 'тривога и паничка', 'в пустоте')];
    expect(find(songs, { title: 'Тривога и паничка', artist: 'Впустоте' })).toBe('s1');
  });

  it('не путает исполнителей с одинаковым названием песни', () => {
    const songs = [song('a', 'Самолёты', 'Земфира'), song('b', 'Самолёты', 'Би-2')];
    expect(find(songs, { title: 'самолеты', artist: 'би 2' })).toBe('b');
    expect(find(songs, { title: 'самолеты', artist: 'Кино' })).toBeNull();
  });

  it('не путает инструменты', () => {
    const songs = [song('u', 'Кошка', 'Кишлак', 'ukulele')];
    expect(find(songs, { title: 'Кошка', artist: 'Кишлак', instrument: 'guitar' })).toBeNull();
    expect(find(songs, { title: 'Кошка', artist: 'Кишлак', instrument: 'ukulele' })).toBe('u');
  });

  it('заявку без исполнителя закрывает самый ранний разбор с тем же названием', () => {
    const songs = [song('first', 'Кошка', 'Кишлак'), song('second', 'кошка', 'Пошлая Молли')];
    expect(find(songs, { title: 'КОШКА', artist: null })).toBe('first');
    expect(find(songs, { title: 'КОШКА', artist: '   ' })).toBe('first');
  });

  it('другое название — не совпадение', () => {
    const songs = [song('s1', 'Тривога и паничка', 'Впустоте')];
    expect(find(songs, { title: 'Тревога', artist: 'Впустоте' })).toBeNull();
  });

  it('пустой каталог и пустое название ничего не находят', () => {
    expect(find([], { title: 'Кошка', artist: 'Кишлак' })).toBeNull();
    expect(find([song('s1', 'Кошка', 'Кишлак')], { title: '', artist: null })).toBeNull();
  });
});
