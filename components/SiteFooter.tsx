import Link from 'next/link';
import { SITE_NAME, TELEGRAM_URL } from '@/lib/site';
import { TelegramIcon } from './TelegramIcon';

/**
 * Подвал сайта.
 *
 * Заведён вместе со страницей «Правообладателям» и по её же надобности: до
 * этого подвала не было вовсе, и постоянной ссылке — той, что должна быть
 * видна с ЛЮБОЙ страницы, — на сайте просто не было места. Контакт для
 * правообладателей, до которого нельзя дойти с середины каталога, не работает.
 *
 * Состав намеренно короткий. Подвал здесь — не карта сайта: разделы разбирает
 * шапка (и нижняя навигация на телефоне), а сюда попадает только то, что нужно
 * редко, но обязано находиться всегда.
 *
 * Кнопка Telegram — справа от ссылок, а на узком экране переходит на отдельную
 * строку под них. Она маленькая и приглушённая, как и всё в подвале: канал не
 * должен спорить с разбором за внимание. Открывается в новой вкладке, чтобы
 * человек не терял место в каталоге.
 *
 * `print-hide`: на распечатанном разборе ссылки бесполезны.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer print-hide">
      <div className="container-app">
        <div className="site-footer-top">
          <nav className="site-footer-nav" aria-label="Дополнительно">
            <Link href="/">Гитара</Link>
            <Link href="/ukulele">Укулеле</Link>
            <Link href="/chords">Аккорды</Link>
            <Link href="/collections">Подборки</Link>
            <Link href="/requests">Заявки на разборы</Link>
            <Link href="/copyright">Правообладателям</Link>
          </nav>
          <a
            className="site-footer-tg"
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <TelegramIcon size={16} />
            <span>Telegram</span>
          </a>
        </div>
        <p className="site-footer-note">
          {SITE_NAME}, {year}. Разборы публикуют пользователи; права на песни принадлежат их
          авторам и правообладателям.{' '}
          <Link href="/copyright">Как удалить материал</Link>.
        </p>
      </div>
    </footer>
  );
}
