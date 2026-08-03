import { telegramBotName, telegramEnabled } from '@/lib/auth';
import { telegramSignInAction } from '@/app/(auth)/actions';
import { TelegramWidget } from './TelegramWidget';

/** Идентификатор формы: по нему виджет находит, куда сложить ответ. */
const FORM_ID = 'tg-login-form';

/**
 * Кнопку рисует не сайт, а сам Telegram: его скрипт вставляет свой фрейм с
 * кнопкой, и другого поддерживаемого способа получить подписанный ответ у
 * виджета нет.
 *
 * Разделение на два компонента вынужденное и важное:
 *
 *   — форма серверная, потому что к ней привязан серверный экшен, и данные
 *     должны уходить обычной отправкой формы;
 *   — сам скрипт виджета вставляется КЛИЕНТСКИМ кодом вручную (см.
 *     TelegramWidget): отданный React тег `<script src>` тот поднимает в
 *     `<head>`, а виджет строит кнопку рядом со своим тегом — и она пропадает.
 *
 * Имя бота читается на сервере и передаётся вниз пропом. Публичной переменной
 * (`NEXT_PUBLIC_…`) для этого не нужно: та подставляется на этапе сборки, из-за
 * чего значение, заданное позже, не подхватывалось бы до пересборки.
 *
 * Если бот не настроен, не рисуем ничего: в отличие от OAuth-кнопок, нажимать
 * тут всё равно нечего.
 */
export function TelegramLoginButton() {
  if (!telegramEnabled) return null;

  return (
    <div className="tg-login">
      <form action={telegramSignInAction} id={FORM_ID}>
        {['id', 'first_name', 'last_name', 'username', 'photo_url', 'auth_date', 'hash'].map(
          (name) => (
            <input key={name} type="hidden" name={name} />
          ),
        )}
      </form>
      <TelegramWidget botName={telegramBotName} formId={FORM_ID} />
    </div>
  );
}
