import { describe, expect, it } from 'vitest';
import { chordsInOrder, withChordChips } from './usedChords';

describe('chordsInOrder', () => {
  it('уникальные аккорды в порядке первого появления', () => {
    const body = `Летит по[2Н]суда, ты [3В]нападаешь с[5Н]зади
Я за[5В]щищался каст[2Н]рюлей, что нам [3В]подарил твой [5Н]дядька`;
    expect(chordsInOrder(body)).toEqual(['2Н', '3В', '5Н', '5В']);
  });

  it('обычные аккорды', () => {
    expect(chordsInOrder('[Am]раз [C]два [G]три [Am]четыре')).toEqual(['Am', 'C', 'G']);
  });

  it('пустой текст — пусто', () => {
    expect(chordsInOrder('просто слова без аккордов')).toEqual([]);
  });
});

describe('withChordChips', () => {
  const row = { id: 'a1', title: 'Тёплый вечер', body: '[Am]раз [C]два [Am]три' };

  it('заменяет текст песни списком аккордов', () => {
    expect(withChordChips(row)).toEqual({
      id: 'a1',
      title: 'Тёплый вечер',
      chords: ['Am', 'C'],
    });
  });

  // Ради этого всё и делалось: строка каталога уезжает на клиент при подгрузке,
  // и текст песни в ней — лишние килобайты на каждую кнопку «Показать ещё».
  it('текста песни в результате не остаётся', () => {
    expect('body' in withChordChips(row)).toBe(false);
  });

  it('остальные поля не трогает', () => {
    const full = { ...row, viewCount: 12, verified: true };
    expect(withChordChips(full)).toMatchObject({ viewCount: 12, verified: true });
  });

  it('исходную строку не мутирует', () => {
    const source = { ...row };
    withChordChips(source);
    expect(source.body).toBe('[Am]раз [C]два [Am]три');
  });
});
