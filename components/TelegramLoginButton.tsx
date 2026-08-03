import { telegramBotToken, telegramEnabled } from '@/lib/auth';
import { telegramAuthUrl } from '@/lib/telegram';
import { absoluteUrl } from '@/lib/site';
import { telegramSignInAction } from '@/app/(auth)/actions';
import { TelegramAuthReturn } from './TelegramAuthReturn';

/** Идентификатор формы: по нему приёмник ответа находит, куда сложить поля. */
const FORM_ID = 'tg-login-form';

/**
 * Вход через Telegram — переходом, а НЕ виджетом.
 *
 * Виджет здесь был и убран. Он рисует кнопку сам, во фрейме со своего домена,
 * поэтому её нельзя ни покрасить, ни растянуть по ширине, ни выровнять с
 * остальными — браузер не пускает в чужой фрейм. Плюс он тянул за собой
 * сторонний скрипт и требовал трёх послаблений в защите: `eval` на страницах
 * входа, разрешённый фрейм и ослабленный COOP ради всплывающего окна.
 *
 * Переход пользуется ровно тем же механизмом Telegram (виджет внутри себя шёл
 * туда же — это было видно по `return_to` в адресе его фрейма), но кнопка
 * остаётся нашей, а все три послабления отменены.
 *
 * Цена — полный переход на страницу Telegram и обратно вместо всплывающего
 * окна, и маленький клиентский приёмник ответа (см. TelegramAuthReturn).
 */
export function TelegramLoginButton() {
  if (!telegramEnabled) return null;

  const href = telegramAuthUrl({
    botToken: telegramBotToken,
    origin: absoluteUrl(''),
    returnTo: absoluteUrl('/login'),
  });
  if (!href) return null;

  return (
    <>
      {/* Скрытая форма: её отправляет приёмник, подпись проверяет сервер. */}
      <form action={telegramSignInAction} id={FORM_ID} className="hidden">
        {['id', 'first_name', 'last_name', 'username', 'photo_url', 'auth_date', 'hash'].map(
          (name) => (
            <input key={name} type="hidden" name={name} />
          ),
        )}
      </form>

      <a href={href} className="btn btn-outline h-11 w-full gap-2.5">
        <TelegramIcon />
        Продолжить с Telegram
      </a>

      <TelegramAuthReturn formId={FORM_ID} />
    </>
  );
}

/** Логотип Telegram — бумажный самолётик на фирменном голубом круге. */
function TelegramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#29A9EB" />
      <path
        fill="#fff"
        d="M5.5 11.8l11-4.24c.51-.19.96.12.79.9l-1.87 8.82c-.14.63-.52.79-1.05.49l-2.9-2.14-1.4 1.35c-.15.15-.29.29-.6.29l.21-3.03 5.5-4.97c.24-.21-.05-.33-.37-.12l-6.8 4.28-2.93-.92c-.64-.2-.65-.63.13-.93z"
      />
    </svg>
  );
}
