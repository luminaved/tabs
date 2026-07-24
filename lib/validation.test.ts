import { describe, expect, it } from 'vitest';
import { normalizeEmail, validateEmail, validatePassword } from './validation';

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
