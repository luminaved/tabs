import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { isAdminUser } from '@/lib/admin';
import { currentVisitorKey } from '@/lib/visitor';
import { listRequests, type RequesterRef } from '@/lib/songRequests';
import { INSTRUMENTS } from '@/lib/chords/instruments';
import { SITE_NAME } from '@/lib/site';
import { RequestForm } from '@/components/RequestForm';
import { OpenRequestRow } from '@/components/OpenRequestRow';
import { deleteRequestAction } from './actions';

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
          <h2 className="mb-1 text-lg font-medium">Ждут разбора</h2>
          {/* Правило сортировки названо прямо. Без него столбик чисел слева —
              просто числа; с ним видно, что нажатие на стрелку двигает песню
              вверх очереди, а верх очереди и есть то, что разбирают раньше. */}
          <p className="mb-4 text-sm text-muted">
            Сверху — то, что просят чаще. Нажмите стрелку, чтобы поднять песню в очереди.
          </p>
          <ul className="flex flex-col gap-2">
            {open.map((r) => (
              <OpenRequestRow key={r.id} request={r}>
                {canModerate ? (
                  <form action={deleteRequestAction} className="shrink-0">
                    <input type="hidden" name="id" value={r.id} />
                    <button
                      type="submit"
                      className="btn btn-ghost h-9 w-9 px-0 text-sm"
                      title="Удалить заявку"
                      aria-label={`Удалить заявку «${r.title}»`}
                    >
                      ×
                    </button>
                  </form>
                ) : null}
              </OpenRequestRow>
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
          <h2 className="mb-1 text-lg font-medium">Уже разобрано</h2>
          <p className="mb-4 text-sm text-muted">
            Эти песни просили — и они появились. Голосовать за них больше не нужно.
          </p>
          <ul className="flex flex-col gap-2">
            {done.map((r) => (
              <li key={r.id}>
                <Link href={r.fulfilledPath!} className="req-row req-row--done">
                  {/* На месте кнопки голоса — галочка: строка сохраняет ту же
                      раскладку, что и открытые заявки, и список не разъезжается
                      на две разные сетки. */}
                  <span className="req-done-mark" aria-hidden>
                    <CheckIcon />
                  </span>
                  <div className="req-body">
                    <div className="req-title-line">
                      <span className="req-title">{r.title}</span>
                      {r.instrument !== 'guitar' ? (
                        <span className="inst-badge shrink-0">
                          {INSTRUMENTS[r.instrument].name}
                        </span>
                      ) : null}
                    </div>
                    <p className="req-meta">{r.artist || 'без исполнителя'}</p>
                  </div>
                  <span className="req-open shrink-0">Открыть разбор →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m20 6-11 11-5-5" />
    </svg>
  );
}
