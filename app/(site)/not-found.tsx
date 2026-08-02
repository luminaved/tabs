import { NotFoundView } from '@/components/NotFoundView';

/**
 * `notFound()` из разделов сайта: удалённый или скрытый разбор
 * (app/(site)/songs/[id]/layout.tsx), несуществующий автор, неизвестный
 * исполнитель, `/admin` без прав администратора.
 *
 * Шапку и нижнюю навигацию даёт layout группы — здесь только содержимое.
 */
export default function SiteNotFound() {
  return <NotFoundView />;
}
