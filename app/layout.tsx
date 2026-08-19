import type { Metadata, Viewport } from 'next';
import { Spectral, Golos_Text } from 'next/font/google';
import { AppleSplashLinks } from '@/components/AppleSplashLinks';
import { ScrollToTop } from '@/components/ScrollToTop';
import { SITE_NAME, SITE_TITLE, SITE_URL } from '@/lib/site';
import './globals.css';

// Антиква для заголовков + гротеск Golos (заточен под кириллицу) для интерфейса.
//
// Набор начертаний — ровно тот, что встречается в стилях, и это не педантизм:
// next/font кладёт КАЖДУЮ пару «начертание × алфавит» отдельным файлом и на
// каждый ставит <link rel="preload"> в <head>. Лишнее начертание — это лишние
// два файла (latin + cyrillic), которые борются за канал с первым экраном на
// любой странице сайта.
//
// ВАЖНО про preload: он игнорирует `unicode-range`. Сам по себе браузер качает
// начертание, только когда встретил его глиф, — но <link rel="preload"> тянет
// файл безусловно, ещё до разбора стилей. Поэтому здесь перечислено ровно то,
// что видно на ПЕРВОМ экране, а всё редкое объявляется с `preload: false`
// (файл остаётся доступен и подгружается по факту появления текста).
//
// 400 отсюда убран: с ним preload на каждой странице тянул ещё latin+cyrillic
// (~23 КБ), а в стилях он не встречается ни разу — класс `.display` всюду идёт
// в паре с `font-medium` (500), а единственное место с 400 — курсивный
// `.cs-comment` ниже, и берёт он italic-начертание, а не это.
const spectral = Spectral({
  subsets: ['latin', 'cyrillic'],
  weight: ['500'],
  variable: '--font-spectral',
  display: 'swap',
});

/**
 * Полужирная антиква — тоже отдельным объявлением и тоже без preload.
 *
 * В стилях она ровно одна: `.key-readout b`, подпись тональности в шапке
 * читалки (см. SongViewer). То есть на каталоге, в кабинете и на страницах
 * исполнителей этих двух файлов (~26 КБ) не нужно вовсе, а preload тянул бы их
 * всюду. Как и с курсивом, начертание остаётся доступным: браузер возьмёт его,
 * когда дойдёт до самой подписи.
 */
const spectralBold = Spectral({
  subsets: ['latin', 'cyrillic'],
  weight: ['600'],
  variable: '--font-spectral-bold',
  display: 'swap',
  preload: false,
});

/**
 * Курсивная антиква. Отдельным объявлением, потому что нужна ровно в одном
 * месте — комментарии внутри текста песни (`.cs-comment`), и только обычной
 * насыщенности. В общем объявлении `style: ['normal', 'italic']` поднимал
 * курсив для всех трёх начертаний сразу: шесть файлов вместо двух.
 *
 * `preload: false` — потому что «ровно в одном месте» здесь буквально: курсив
 * появляется только внутри текста песни и только если у неё есть {comment}.
 * С preload эти два файла (~26 КБ) тянулись бы на каждой странице сайта, в том
 * числе на каталоге, где курсива нет вовсе. Начертание при этом никуда не
 * девается: браузер скачает его, когда встретит первый курсивный глиф.
 *
 * `--font-spectral-italic` не используется в стилях намеренно: объявление
 * попадает в то же семейство 'Spectral' отдельным @font-face со
 * `font-style: italic`, и `.cs-comment` выбирает его обычным `font-style`.
 * Переменная остаётся только как след объявления — см. globals.css.
 */
const spectralItalic = Spectral({
  subsets: ['latin', 'cyrillic'],
  weight: ['400'],
  style: ['italic'],
  variable: '--font-spectral-italic',
  display: 'swap',
  preload: false,
});

// 700 здесь был, но в стилях не встречается ни разу (самое жирное — 600).
const golos = Golos_Text({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600'],
  variable: '--font-golos',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    // Страницы задают свой заголовок БЕЗ бренда — хвост подставляется здесь.
    template: `%s | ${SITE_NAME}`,
  },
  description:
    'Аккорды песен на гитару: текст с аккордами над словами, аппликатуры, ' +
    'транспонирование в любую тональность и разборы от других гитаристов.',
  applicationName: SITE_NAME,
  alternates: {
    canonical: '/',
    // Ссылка на ленту в <head> — то, как её находят читалки и агрегаторы:
    // сам файл ниоткуда не виден, если о нём не сказать здесь.
    types: { 'application/rss+xml': [{ url: '/feed.xml', title: `${SITE_NAME} — новые разборы` }] },
  },
  // Подтверждение прав в панелях вебмастера. Значения — из окружения, а не
  // строкой в коде: они привязаны к конкретному аккаунту, и в общем репозитории
  // им не место. Пусто — тег просто не выводится (у Google права уже
  // подтверждены файлом в public/, это запасной способ и место для Яндекса,
  // который для русскоязычного сайта даёт заметную часть трафика).
  verification: {
    ...(process.env.GOOGLE_SITE_VERIFICATION
      ? { google: process.env.GOOGLE_SITE_VERIFICATION }
      : {}),
    ...(process.env.YANDEX_VERIFICATION ? { yandex: process.env.YANDEX_VERIFICATION } : {}),
  },
  /**
   * «На экран „Домой“» на iOS.
   *
   * Дублирует то, что уже сказано в манифесте (app/manifest.ts), и это не
   * лишнее: манифест Safari читает только с iOS 16.4, а до неё понимает
   * исключительно эти мета-теги. Вместе они покрывают и старые айфоны, и новые.
   *
   * `statusBarStyle: 'black'`, а не 'black-translucent': полупрозрачная строка
   * состояния пускает содержимое под чёлку, и шапка сайта уехала бы под часы —
   * вёрстка на это не рассчитана. С 'black' система оставляет полосу своей, и
   * по цвету она совпадает с фоном (--color-bg).
   *
   * `title` — подпись под иконкой, поэтому здесь короткое имя, а не SITE_TITLE:
   * длинное система всё равно обрежет многоточием.
   */
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: 'black',
  },
  /**
   * `apple-mobile-web-app-capable` руками — и это не дубль.
   *
   * На `capable: true` выше Next (15.x) выводит ТОЛЬКО современный
   * `mobile-web-app-capable`: apple-версия считается устаревшей, и её он больше
   * не ставит. Но именно её читает Safari до iOS 16.4 — а без неё ярлык с
   * домашнего экрана открывается обычной вкладкой, с адресной строкой, то есть
   * ровно без того, ради чего всё и делалось. С 16.4 и новее этот тег не нужен
   * (там работает манифест), но и не мешает.
   *
   * Если Next однажды начнёт выводить оба — строку убрать: два одинаковых мета
   * лучше не плодить.
   */
  other: {
    'apple-mobile-web-app-capable': 'yes',
  },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'ru_RU',
    url: '/',
    title: SITE_TITLE,
    description:
      'Аккорды песен на гитару: текст с аккордами над словами, аппликатуры и транспонирование.',
  },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = {
  themeColor: '#0e0d0b',
  width: 'device-width',
  initialScale: 1,
  // Пускает контент под системные полосы (жесты снизу на Android, «чёлка»
  // сверху на iOS). Без этого env(safe-area-inset-*) везде равен нулю, и
  // между нижней навигацией сайта и областью жестов ОС виден шов другого
  // оттенка. .mnav и body уже дают отступ через env(safe-area-inset-bottom),
  // так что фон панели с backdrop-blur теперь заливает и область жестов.
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ru"
      className={`${golos.variable} ${spectral.variable} ${spectralBold.variable} ${spectralItalic.variable}`}
    >
      <body>
        {/* Заставки для запуска с домашнего экрана на iOS. React поднимает эти
            <link> в <head> сам — Metadata API их выразить не умеет. */}
        <AppleSplashLinks />
        {/* Общий для всех разделов сброс прокрутки при переходах */}
        <ScrollToTop />
        {children}
      </body>
    </html>
  );
}
