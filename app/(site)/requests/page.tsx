import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { isAdminUser } from '@/lib/admin';
import { currentVisitorKey } from '@/lib/visitor';
import { TITLE_MAX, listRequests, type RequesterRef } from '@/lib/songRequests';
import { SITE_NAME } from '@/lib/site';
import { RequestsBoard } from '@/components/RequestsBoard';

/**
 * Страница из индекса закрыта, и это не осторожность, а осознанный отказ.
 *
 * Список состоит из названий песен, которых у нас НЕТ. В выдаче он конкурировал
 * бы с собственными разборами по тем же запросам и приводил человека на пустую
 * страницу вместо аккордов — то есть работал бы против сайта. `follow`
 * оставляем: ссылки отсюда на уже готовые разборы должны учитываться.
 */
export const metadata: Metadata = {
  title: 'Заявки на разборы',
  description: 'Какие песни просят разобрать. Оставьте заявку — или поддержите чужую.',
  robots: { index: false, follow: true },
  openGraph: {
    type: 'website',
    url: '/requests',
    siteName: SITE_NAME,
    locale: 'ru_RU',
    title: 'Заявки на разборы',
    description: 'Какие песни просят разобрать.',
  },
};

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;

  // Каталог ведёт сюда с набранным запросом («Запросить разбор этой песни →»):
  // человек только что искал и не нашёл, второй раз набирать название незачем.
  const { q } = await searchParams;
  const initialQuery = (typeof q === 'string' ? q : '').trim().slice(0, TITLE_MAX);

  // Кто просит — как у просмотров: аккаунт либо суточный отпечаток.
  const requester: RequesterRef | null = userId
    ? { userId }
    : await currentVisitorKey().then((key) => (key ? { visitorId: key } : null));

  const [requests, canModerate] = await Promise.all([
    listRequests(requester),
    isAdminUser(userId),
  ]);

  return (
    <main className="container-app py-8 sm:py-12">
      <div className="rq-page">
        <header className="rq-head">
          <p className="eyebrow mb-3">Заявки</p>
          <h1 className="display text-[2.1rem] font-medium sm:text-5xl">Какую песню разобрать?</h1>
          <p className="mt-3 max-w-prose text-muted">
            Нет нужного разбора — оставьте заявку. Что просят чаще, то и разбираем раньше. Вход не
            нужен.
          </p>
        </header>

        {/* В клиент уходят только поля, нужные для показа: даты и прочее
            остаются на сервере. */}
        <RequestsBoard
          canModerate={canModerate}
          initialQuery={initialQuery}
          requests={requests.map((r) => ({
            id: r.id,
            title: r.title,
            artist: r.artist,
            instrument: r.instrument,
            votes: r.votes,
            mine: r.mine,
            fulfilledPath: r.fulfilledPath,
            linkedManually: r.linkedManually,
          }))}
        />
      </div>
    </main>
  );
}
