import type { Metadata, Viewport } from 'next';
import { Spectral, Golos_Text } from 'next/font/google';
import { SITE_NAME, SITE_TITLE, SITE_URL } from '@/lib/site';
import './globals.css';

// Антиква для заголовков + гротеск Golos (заточен под кириллицу) для интерфейса.
const spectral = Spectral({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-spectral',
  display: 'swap',
});

const golos = Golos_Text({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
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
  alternates: { canonical: '/' },
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
    <html lang="ru" className={`${golos.variable} ${spectral.variable}`}>
      <body>{children}</body>
    </html>
  );
}
