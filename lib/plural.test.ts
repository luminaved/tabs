import { describe, expect, it } from 'vitest';
import { compactRu, pluralRu, withPluralRu } from './plural';

const razbor = (n: number) => pluralRu(n, 'разбор', 'разбора', 'разборов');

describe('pluralRu', () => {
  it('единственное число — на 1, кроме 11', () => {
    expect(razbor(1)).toBe('разбор');
    expect(razbor(21)).toBe('разбор');
    expect(razbor(101)).toBe('разбор');
    expect(razbor(11)).toBe('разборов');
  });

  it('форма «мало» — на 2..4, кроме 12..14', () => {
    expect(razbor(2)).toBe('разбора');
    expect(razbor(3)).toBe('разбора');
    expect(razbor(4)).toBe('разбора');
    expect(razbor(22)).toBe('разбора');
    expect(razbor(104)).toBe('разбора');
    expect(razbor(12)).toBe('разборов');
    expect(razbor(13)).toBe('разборов');
    expect(razbor(14)).toBe('разборов');
  });

  it('множественное — на 0, 5..9 и десятки 11..14', () => {
    expect(razbor(0)).toBe('разборов');
    expect(razbor(5)).toBe('разборов');
    expect(razbor(9)).toBe('разборов');
    expect(razbor(25)).toBe('разборов');
    expect(razbor(111)).toBe('разборов');
  });

  // Раньше на странице исполнителя форма выбиралась по `n < 5`: 21 и 22 давали
  // «разборов». Тест держит именно эти числа, чтобы правило не откатилось.
  it('не путается на числах после двадцати', () => {
    expect(razbor(20)).toBe('разборов');
    expect(razbor(21)).toBe('разбор');
    expect(razbor(22)).toBe('разбора');
    expect(razbor(25)).toBe('разборов');
  });

  it('дробное и отрицательное приводятся к целому по модулю', () => {
    expect(razbor(1.7)).toBe('разбор');
    expect(razbor(-2)).toBe('разбора');
  });

  it('withPluralRu подставляет само число', () => {
    expect(withPluralRu(1, 'минуту', 'минуты', 'минут')).toBe('1 минуту');
    expect(withPluralRu(5, 'струна', 'струны', 'струн')).toBe('5 струн');
  });
});

describe('compactRu', () => {
  it('до тысячи число остаётся как есть', () => {
    expect(compactRu(0)).toBe('0');
    expect(compactRu(52)).toBe('52');
    expect(compactRu(999)).toBe('999');
  });

  it('тысячи: один знак после запятой, пока меньше десяти', () => {
    expect(compactRu(1000)).toBe('1 тыс.');
    expect(compactRu(1234)).toBe('1,2 тыс.');
    expect(compactRu(9990)).toBe('9,9 тыс.');
  });

  it('от десяти тысяч дробь уже не показывается', () => {
    expect(compactRu(12_400)).toBe('12 тыс.');
    expect(compactRu(123_900)).toBe('123 тыс.');
  });

  it('дробь отбрасывается, а не округляется', () => {
    // 1250 — это «1,2 тыс.», а не «1,3»: счётчик не должен показывать больше,
    // чем есть на самом деле.
    expect(compactRu(1250)).toBe('1,2 тыс.');
    expect(compactRu(1299)).toBe('1,2 тыс.');
    // Край диапазона: округление дало бы бессмысленное «1000 тыс.»
    expect(compactRu(999_999)).toBe('999 тыс.');
  });

  it('миллионы', () => {
    expect(compactRu(1_000_000)).toBe('1 млн');
    expect(compactRu(1_500_000)).toBe('1,5 млн');
    expect(compactRu(3_000_000)).toBe('3 млн');
  });

  it('дробное и отрицательное', () => {
    expect(compactRu(1234.9)).toBe('1,2 тыс.');
    expect(compactRu(-1234)).toBe('-1,2 тыс.');
  });
});
