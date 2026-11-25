import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { MobileNavBar } from '@/components/MobileNavBar';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
      {/* Подвал — ради постоянной ссылки на страницу для правообладателей:
          она обязана быть видна с любой страницы, а не только с главной. */}
      <SiteFooter />
      {/* Нижняя навигация — только на телефоне (от `sm` скрыта в CSS) */}
      <MobileNavBar />
    </>
  );
}
