import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password', () => {
  it('верный пароль проходит проверку, неверный — нет', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(await verifyPassword('correct horse battery', hash)).toBe(true);
    expect(await verifyPassword('wrong password', hash)).toBe(false);
  });

  it('хеш отличается от исходного пароля', async () => {
    const hash = await hashPassword('secret123');
    expect(hash).not.toBe('secret123');
  });
});
