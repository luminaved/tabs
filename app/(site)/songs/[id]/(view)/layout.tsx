import { permanentRedirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getSongForViewer } from '@/lib/songs';
import { songIdFromParam, songPath } from '@/lib/slug';

/**
 * Приведение адреса к каноническому: `/songs/<id>` и `/songs/<чужая-подпись>-<id>`
 * получают 308 на `/songs/<подпись>-<id>` (см. [lib/slug.ts](../../../../../lib/slug.ts)).
 *
 * Зачем редирект, если есть canonical: canonical — просьба, редирект — факт.
 * Поисковик склеивает варианты быстрее и надёжнее, а главное — люди перестают
 * копировать из адресной строки ссылку без подписи.
 *
 * Почему группа `(view)`, а не сегмент `[id]` целиком: layout сегмента `[id]`
 * оборачивает и редактор (`/songs/<id>/edit`), и редирект уносил бы владельца
 * из редактора на страницу разбора. Группа в адресе не участвует, поэтому
 * правило действует ровно на просмотр.
 *
 * Почему layout, а не сама страница: рядом лежит `loading.tsx`, из-за которого
 * ответ уходит стримом — заголовок Location после начала стрима поставить уже
 * нельзя. Layout своей группы рендерится ВЫШЕ этой Suspense-границы (тем же
 * приёмом сделан 404 в layout сегмента `[id]`).
 *
 * Лишнего запроса нет: `getSongForViewer` обёрнут в `cache()` и уже прогрет
 * проверкой существования этажом выше.
 */
export default async function SongViewLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const song = await getSongForViewer(songIdFromParam(id), session?.user?.id);
  // Разбора нет — молчим: 404 отдаёт layout сегмента выше, и дублировать
  // проверку значило бы иметь два места, где решается один и тот же вопрос.
  if (!song) return <>{children}</>;

  const canonical = songPath(song);
  if (canonical !== `/songs/${id}`) permanentRedirect(canonical);

  return <>{children}</>;
}
