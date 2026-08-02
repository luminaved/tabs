import type { Metadata } from 'next';
import { SiteHeader } from '@/components/SiteHeader';
import { NotFoundView } from '@/components/NotFoundView';

/**
 * Несуществующий адрес, не совпавший ни с одним маршрутом.
 *
 * Отрисовывается в корневом layout, а он шапку не содержит (её даёт layout
 * группы `(site)`, до которой такой адрес не доходит) — поэтому ставим её
 * здесь сами, чтобы уйти со страницы было куда.
 */
export const metadata: Metadata = {
  title: 'Страница не найдена',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <NotFoundView />
    </>
  );
}
