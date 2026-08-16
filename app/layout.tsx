import type { Metadata, Viewport } from 'next';
import { Spectral, Golos_Text } from 'next/font/google';
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
const spectral = Spectral({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600'],
  variable: '--font-spectral',
  display: 'swap',
});

/**
 * Курсивная антиква. Отдельным объявлением, потому что нужна ровно в одном
 * месте — комментарии внутри текста песни (`.cs-comment`), и только обычной
 * насыщенности. В общем объявлении `style: ['normal', 'italic']` поднимал
 * курсив для всех трёх начертаний сразу: шесть файлов вместо двух.
 */
const spectralItalic = Spectral({
  subsets: ['latin', 'cyrillic'],
  weight: ['400'],
  style: ['italic'],
  variable: '--font-spectral-italic',
  display: 'swap',
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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ru"
      className={`${golos.variable} ${spectral.variable} ${spectralItalic.variable}`}
    >
      <body>
        {/* Общий для всех разделов сброс прокрутки при переходах */}
        <ScrollToTop />
        {children}
      </body>
    </html>
  );
}
