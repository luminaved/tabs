'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    onTelegramAuth?: (user: Record<string, string | number>) => void;
  }
}

/**
 * Вставка виджета Telegram — вручную, в обход React.
 *
 * Почему не тегом `<script>` прямо в разметке, как напрашивается: React 19
 * ПОДНИМАЕТ теги `<script src>` в `<head>` — это его штатная работа с
 * метаданными документа. А виджет Telegram строит кнопку рядом со СВОИМ тегом
 * скрипта (он находит себя через `document.currentScript`). Тег уезжает в
 * `<head>` — и кнопке некуда встать: скрипт грузится, отрабатывает, а на
 * странице не появляется ничего. Ровно это и происходило, причём молча: ни
 * ошибки в консоли, ни отказа в сети.
 *
 * Созданный руками узел React не трогает, поэтому `document.currentScript`
 * указывает внутрь нашего контейнера, и кнопка встаёт на своё место.
 *
 * CSP это не ломает: политика собрана на `strict-dynamic` (см. middleware.ts),
 * а он для того и нужен — доверие переходит к скриптам, созданным уже
 * доверенным скриптом. Отдельный nonce тут поэтому не требуется.
 */
export function TelegramWidget({ botName, formId }: { botName: string; formId: string }) {
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = holder.current;
    if (!node) return;

    // Виджет зовёт эту функцию по имени из `data-onauth`, поэтому она обязана
    // жить в window, а не в замыкании.
    window.onTelegramAuth = (user) => {
      const form = document.getElementById(formId);
      if (!(form instanceof HTMLFormElement)) return;
      for (const [key, value] of Object.entries(user)) {
        const field = form.elements.namedItem(key);
        if (field instanceof HTMLInputElement) field.value = String(value);
      }
      form.requestSubmit();
    };

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', botName);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '10');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    node.appendChild(script);

    return () => {
      // Убираем и скрипт, и построенную им кнопку: при повторном подключении
      // виджет добавит свою заново, и без уборки их стало бы две.
      node.replaceChildren();
      delete window.onTelegramAuth;
    };
  }, [botName, formId]);

  return <div ref={holder} />;
}
