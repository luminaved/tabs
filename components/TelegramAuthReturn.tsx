'use client';

import { useEffect } from 'react';
// Импорт из telegramResult, а НЕ из telegram: тот тянет `node:crypto` ради
// проверки подписи, и клиентский бандл на нём не собирается.
import { parseTgAuthResult } from '@/lib/telegramResult';

/**
 * Приём ответа Telegram после возвращения с его страницы.
 *
 * Клиентский код здесь не прихоть, а единственный способ: Telegram кладёт ответ
 * в ЯКОРЬ адреса (`#tgAuthResult=…`), а якорь браузер на сервер не отправляет —
 * серверу он попросту не виден. Забрать его может только страница.
 *
 * Дальше поля раскладываются по скрытой форме и та отправляется обычным
 * образом, то есть подпись проверяет сервер (см. lib/telegram.ts). На клиенте
 * ничему не доверяем: он лишь курьер.
 *
 * Якорь после разбора стираем — иначе он остался бы в адресной строке, уехал
 * бы в закладку или в чужие руки вместе со ссылкой.
 */
export function TelegramAuthReturn({ formId }: { formId: string }) {
  useEffect(() => {
    const data = parseTgAuthResult(window.location.hash);
    if (!data) return;

    // Убираем якорь до отправки: если что-то пойдёт не так и человек обновит
    // страницу, повторной попытки входа по старому ответу не случится.
    history.replaceState(null, '', window.location.pathname + window.location.search);

    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;

    for (const [key, value] of Object.entries(data)) {
      const field = form.elements.namedItem(key);
      if (field instanceof HTMLInputElement) field.value = value;
    }
    form.requestSubmit();
  }, [formId]);

  return null;
}
