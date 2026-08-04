/** Валидация ввода регистрации/входа. Чистые функции, покрыты тестами. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PASSWORD_MIN = 8;
// bcrypt учитывает только первые 72 байта — длиннее молча обрезается,
// поэтому явно ограничиваем, чтобы не вводить пользователя в заблуждение.
export const PASSWORD_MAX_BYTES = 72;

/**
 * Отображаемое имя. Живёт ЗДЕСЬ, а не в экшене кабинета, потому что имя
 * задаётся из двух мест: при регистрации и при правке профиля. Потолок стоял
 * только во втором, поэтому обходился первым — достаточно было завести аккаунт
 * с именем в десять тысяч символов, и оно ехало в шапку, в списки и в
 * заголовок публичного профиля.
 */
export const NAME_MAX = 80;

/**
 * Приводит отображаемое имя из формы: пусто → null. Возвращает текст ошибки
 * либо готовое значение — так оба вызывающих экшена получают одинаковый
 * результат и не могут разойтись.
 */
export function parseDisplayName(raw: string): { name: string | null } | { error: string } {
  const name = raw.trim() || null;
  if (name && name.length > NAME_MAX) {
    return { error: `Имя длиннее ${NAME_MAX} символов` };
  }
  return { name };
}

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
