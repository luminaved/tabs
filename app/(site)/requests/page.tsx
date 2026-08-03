import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { isAdminUser } from '@/lib/admin';
import { currentVisitorKey } from '@/lib/visitor';
import { listRequests, type RequesterRef } from '@/lib/songRequests';
import { INSTRUMENTS } from '@/lib/chords/instruments';
import { SITE_NAME } from '@/lib/site';
import { RequestForm } from '@/components/RequestForm';
import { deleteRequestAction, voteRequestAction } from './actions';

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

export default async function RequestsPage() {
  const session = await auth();
  const userId = session?.user?.id;

  // Кто просит — как у просмотров: аккаунт либо суточный отпечаток.
  const requester: RequesterRef | null = userId
    ? { userId }
    : await currentVisitorKey().then((key) => (key ? { visitorId: key } : null));

  const [requests, canModerate] = await Promise.all([
    listRequests(requester),
    isAdminUser(userId),
  ]);

  const open = requests.filter((r) => !r.fulfilledPath);
  const done = requests.filter((r) => r.fulfilledPath);

  return (
    <main className="container-app py-10">
      <div className="mb-6">
        <p className="eyebrow mb-2">Заявки</p>
        <h1 className="display text-4xl font-medium">Какую песню разобрать?</h1>
        <p className="mt-2 max-w-prose text-muted">
          Не нашли нужного разбора — оставьте заявку. Что просят чаще, то и разбираем раньше.
          Вход не нужен.
        </p>
      </div>

      <div className="mb-10">
        <RequestForm />
      </div>

      {open.length > 0 ? (
        <section className="mb-10">
          <h2 className="eyebrow mb-3">Ждут разбора</h2>
          <ul className="flex flex-col gap-2">
            {open.map((r) => (
              <li key={r.id} className="song-row">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-lg font-medium">{r.title}</span>
                    {r.instrument !== 'guitar' ? (
                      <span className="inst-badge shrink-0">{INSTRUMENTS[r.instrument].name}</span>
                    ) : null}
                  </div>
                  {/* Счётчик живёт на кнопке — дублировать его здесь незачем. */}
                  <p className="truncate text-sm text-muted">
                    {r.artist || 'без исполнителя'}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {/* Обычная форма, а не кнопка на JS: голос — это запись в базу,
                      и она должна работать даже там, где скрипты не выполнились. */}
                  <form action={voteRequestAction}>
                    {/* Только идентификатор: голос ничего не создаёт, поэтому
                        название с исполнителем экшену больше не нужны — и тем
                        меньше данных, которым он мог бы поверить. */}
                    <input type="hidden" name="id" value={r.id} />
                    <button
                      type="submit"
                      disabled={r.mine}
                      className={`btn h-9 px-3 text-sm ${r.mine ? 'btn-ghost' : 'btn-outline'}`}
                      title={r.mine ? 'Вы уже просили эту песню' : 'Мне тоже нужен этот разбор'}
                    >
                      {r.mine ? `✓ ${r.votes}` : `+1 · ${r.votes}`}
                    </button>
                  </form>

                  {canModerate ? (
                    <form action={deleteRequestAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <button
                        type="submit"
                        className="btn btn-ghost h-9 w-9 px-0 text-sm"
                        title="Удалить заявку"
                        aria-label="Удалить заявку"
                      >
                        ×
                      </button>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="card px-6 py-12 text-center text-muted">
          Открытых заявок пока нет. Ваша будет первой.
        </p>
      )}

      {/* Выполненные не прячем: пустой список заявок, где сделанное стёрто,
          выглядит как заброшенная форма. Здесь видно, что просить работает. */}
      {done.length > 0 ? (
        <section>
          <h2 className="eyebrow mb-3">Уже разобрано</h2>
          <ul className="flex flex-col gap-2">
            {done.map((r) => (
              <li key={r.id}>
                <Link href={r.fulfilledPath!} className="song-row">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-lg font-medium">{r.title}</span>
                      {r.instrument !== 'guitar' ? (
                        <span className="inst-badge shrink-0">
                          {INSTRUMENTS[r.instrument].name}
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-sm text-muted">
                      {r.artist || 'без исполнителя'} · разбор готов →
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
