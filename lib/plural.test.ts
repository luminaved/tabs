import { describe, expect, it } from 'vitest';
import { pluralRu, withPluralRu } from './plural';

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
