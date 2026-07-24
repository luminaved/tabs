/** Валидация ввода регистрации/входа. Чистые функции, покрыты тестами. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PASSWORD_MIN = 8;
// bcrypt учитывает только первые 72 байта — длиннее молча обрезается,
// поэтому явно ограничиваем, чтобы не вводить пользователя в заблуждение.
export const PASSWORD_MAX_BYTES = 72;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string): boolean {
  return EMAIL_RE.test(normalizeEmail(email));
}

/** Возвращает текст ошибки либо null, если пароль валиден. */
export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN) {
    return `Пароль должен быть не короче ${PASSWORD_MIN} символов`;
  }
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) {
    return 'Пароль слишком длинный';
  }
  return null;
}
