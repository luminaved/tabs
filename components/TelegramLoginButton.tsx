import { headers } from 'next/headers';
import { telegramBotName, telegramEnabled } from '@/lib/auth';
import { telegramSignInAction } from '@/app/(auth)/actions';

/**
 * Кнопка входа через Telegram.
 *
 * В отличие от остальных провайдеров, здесь кнопку рисует не сайт, а сам
 * Telegram: его скрипт вставляет свой iframe с кнопкой, и другого
 * поддерживаемого способа получить подписанный ответ у виджета нет.
 *
 * Отсюда три особенности, каждая из которых обязательна:
 *
 * 1. Скрипту нужен `nonce`. CSP собран на `strict-dynamic` (см. middleware.ts),
 *    поэтому список разрешённых хостов браузер игнорирует, и единственный
 *    способ пустить чужой скрипт — выдать ему тот же одноразовый nonce, что и
 *    своим. Без этого кнопка просто не появится.
 *
 * 2. Ответ приходит в глобальную функцию. Виджет умеет либо звать функцию по
 *    имени из `data-onauth`, либо слать POST на свой адрес. Берём первое и
 *    отправляем скрытую форму — так данные уходят серверным экшеном, а не
 *    отдельным маршрутом, и проверка подписи остаётся в одном месте.
 *
 * 3. Компонент серверный. `nonce` живёт в заголовках запроса, до клиента он не
 *    доезжает — значит и тег скрипта должен родиться на сервере.
 *
 * Если бот не настроен, не рисуем ничего: заглушка «настройте бота» тут не
 * поможет — в отличие от OAuth-кнопок, нажимать всё равно нечего.
 */
export async function TelegramLoginButton() {
  if (!telegramEnabled) return null;

  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <div className="tg-login">
      <form action={telegramSignInAction} id="tg-login-form">
        {['id', 'first_name', 'last_name', 'username', 'photo_url', 'auth_date', 'hash'].map(
          (name) => (
            <input key={name} type="hidden" name={name} />
          ),
        )}
      </form>

      {/* Приёмник ответа виджета: раскладывает поля по скрытым полям формы и
          отправляет её. Инлайновый скрипт с тем же nonce, что и остальные. */}
      <script
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: `window.onTelegramAuth=function(u){var f=document.getElementById('tg-login-form');if(!f)return;Object.keys(u).forEach(function(k){var i=f.elements[k];if(i)i.value=u[k];});f.requestSubmit();};`,
        }}
      />
      <script
        async
        nonce={nonce}
        src="https://telegram.org/js/telegram-widget.js?22"
        data-telegram-login={telegramBotName}
        data-size="large"
        data-radius="10"
        data-onauth="onTelegramAuth(user)"
        data-request-access="write"
      />
    </div>
  );
}
