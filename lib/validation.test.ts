import { describe, expect, it } from 'vitest';
import {
  NAME_MAX,
  normalizeEmail,
  parseDisplayName,
  validateEmail,
  validatePassword,
} from './validation';

describe('normalizeEmail', () => {
  it('обрезает пробелы и приводит к нижнему регистру', () => {
    expect(normalizeEmail('  User@Example.COM ')).toBe('user@example.com');
  });
});

describe('validateEmail', () => {
  it('корректные адреса', () => {
    expect(validateEmail('a@b.co')).toBe(true);
    expect(validateEmail(' Person@Site.ru ')).toBe(true);
  });
  it('некорректные адреса', () => {
    expect(validateEmail('нет-собаки')).toBe(false);
    expect(validateEmail('a@b')).toBe(false);
    expect(validateEmail('a b@c.com')).toBe(false);
    expect(validateEmail('')).toBe(false);
  });
});

describe('validatePassword', () => {
  it('валидный пароль → null', () => {
    expect(validatePassword('12345678')).toBeNull();
  });
  it('короткий пароль → ошибка', () => {
    expect(validatePassword('1234567')).toContain('короче');
  });
  it('слишком длинный (>72 байт) → ошибка', () => {
    expect(validatePassword('a'.repeat(73))).toContain('длинный');
  });
});

describe('parseDisplayName', () => {
  it('обрезает пробелы', () => {
    expect(parseDisplayName('  Ната  ')).toEqual({ name: 'Ната' });
  });

  it('пустое имя — это null, а не пустая строка', () => {
    expect(parseDisplayName('')).toEqual({ name: null });
    expect(parseDisplayName('   ')).toEqual({ name: null });
  });

  it('ровно потолок проходит', () => {
    expect(parseDisplayName('я'.repeat(NAME_MAX))).toEqual({ name: 'я'.repeat(NAME_MAX) });
  });

  it('длиннее потолка → ошибка (и на регистрации, и в кабинете)', () => {
    const result = parseDisplayName('я'.repeat(NAME_MAX + 1));
    expect(result).toHaveProperty('error');
  });

  it('пробелы не помогают обойти потолок', () => {
    expect(parseDisplayName(`  ${'я'.repeat(NAME_MAX)}  `)).not.toHaveProperty('error');
    expect(parseDisplayName(`  ${'я'.repeat(NAME_MAX + 1)}  `)).toHaveProperty('error');
  });
});
