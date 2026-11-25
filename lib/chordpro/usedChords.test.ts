import { describe, expect, it } from 'vitest';
import { chordsInOrder } from './usedChords';

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
