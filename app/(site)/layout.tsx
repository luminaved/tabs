import { SiteHeader } from '@/components/SiteHeader';
import { MobileNavBar } from '@/components/MobileNavBar';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
      {/* Нижняя навигация — только на телефоне (от `sm` скрыта в CSS) */}
      <MobileNavBar />
    </>
  );
}
