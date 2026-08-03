/**
 * Разбор ответа, с которым Telegram возвращает человека обратно.
 *
 * Живёт ОТДЕЛЬНО от lib/telegram.ts намеренно: эта функция единственная из всей
 * телеграмной обвязки нужна в браузере, а соседний модуль импортирует
 * `node:crypto` ради проверки подписи. Импорт из клиентского компонента утащил
 * бы за собой весь модуль, и сборка падала бы на «Reading from node:crypto is
 * not handled» — что и произошло, когда обе половины лежали вместе.
 *
 * Здесь ничему не доверяем и ничего не решаем: функция лишь достаёт поля.
 * Подлинность проверяет сервер (см. verifyTelegramAuth) — клиент только курьер.
 */

/**
 * Ответ приезжает в ЯКОРЕ адреса (`#tgAuthResult=…`), а не в строке запроса, и
 * это важно: якорь браузер на сервер не отправляет. Поэтому забрать его может
 * только код на странице.
 *
 * Внутри — base64 от JSON с полями профиля. Кодировка URL-безопасная (`-` и `_`
 * вместо `+` и `/`), дополняющие `=` могут быть срезаны — восстанавливаем и то
 * и другое.
 */
export function parseTgAuthResult(hash: string): Record<string, string> | null {
  const m = /(?:^#?|&)tgAuthResult=([^&]+)/.exec(hash);
  if (!m) return null;

  try {
    const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);

    // `atob` отдаёт БАЙТЫ, разложенные по символам latin-1, а не текст.
    // Скормить их прямо в JSON.parse нельзя: «Юрий» превращается в «Ð®ÑÐ¸Ð¹»,
    // и ломается это ровно на кириллице — то есть почти на всех, кто сюда
    // придёт. Поэтому байты собираем обратно и раскодируем как UTF-8.
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    const json = JSON.parse(new TextDecoder().decode(bytes));
    if (!json || typeof json !== 'object') return null;

    // Значения приводим к строкам: id и auth_date приходят числами, а дальше
    // всё уходит в поля формы и в проверку подписи, где нужны строки.
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(json)) {
      if (v !== null && v !== undefined) out[k] = String(v);
    }
    return out.hash ? out : null;
  } catch {
    return null;
  }
}
