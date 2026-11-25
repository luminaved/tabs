'use client';

import { useActionState } from 'react';
import type { ReactNode } from 'react';
import { INSTRUMENTS, type InstrumentId } from '@/lib/chords/instruments';
import { pluralRu } from '@/lib/plural';
import { voteRequestAction, type VoteState } from '@/app/(site)/requests/actions';

/**
 * Строка открытой заявки — с кнопкой голоса.
 *
 * Клиентская она ровно ради одного: у отказа должно быть объяснение. Экшен
 * отбивает голос при исчерпанном лимите, и раньше это выглядело как сломанная
 * кнопка — счётчик не двигался, текста не было. `useActionState` даёт место,
 * куда этот текст положить.
 *
 * Без JS страница при этом не ломается: форма остаётся обычной формой с
 * серверным экшеном, отправляется браузером и обновляет счётчик. Не показанным
 * останется только сообщение об отказе — то есть ровно то, чего раньше не было
 * вообще.
 *
 * Выполненные заявки этот компонент не рендерит: там нет кнопки, а значит и
 * состояния, — они остаются обычной серверной разметкой.
 */
export function OpenRequestRow({
  request,
  children,
}: {
  request: {
    id: string;
    title: string;
    artist: string | null;
    instrument: InstrumentId;
    votes: number;
    mine: boolean;
  };
  /** Кнопка удаления для администратора — приходит с сервера уже проверенной. */
  children?: ReactNode;
}) {
  const [state, action, pending] = useActionState<VoteState, FormData>(voteRequestAction, {});

  return (
    <li className="req-row">
      {/* Обычная форма, а не кнопка на JS: голос — это запись в базу,
          и она должна работать даже там, где скрипты не выполнились. */}
      <form action={action} className="shrink-0">
        {/* Только идентификатор: голос ничего не создаёт, поэтому
            название с исполнителем экшену больше не нужны — и тем
            меньше данных, которым он мог бы поверить. */}
        <input type="hidden" name="id" value={request.id} />
        <button
          type="submit"
          disabled={request.mine || pending}
          className={request.mine ? 'req-vote req-vote--on' : 'req-vote'}
          aria-label={
            request.mine
              ? `Ваш голос за «${request.title}» учтён. Сейчас просят: ${request.votes}`
              : `Поднять «${request.title}» в очереди. Сейчас просят: ${request.votes}`
          }
          title={request.mine ? 'Ваш голос учтён' : 'Поднять в очереди — разберём раньше'}
        >
          <ArrowUpIcon />
          <span className="req-vote-count">{request.votes}</span>
          {/* Подпись под числом — чтобы столбик не читался как «+1».
              Слово то же, что в схеме: счётчик мерит спрос, а не
              число уникальных людей. */}
          <span className="req-vote-label">
            {pluralRu(request.votes, 'просит', 'просят', 'просят')}
          </span>
        </button>
      </form>

      <div className="req-body">
        <div className="req-title-line">
          <span className="req-title">{request.title}</span>
          {request.instrument !== 'guitar' ? (
            <span className="inst-badge shrink-0">{INSTRUMENTS[request.instrument].name}</span>
          ) : null}
        </div>
        {/* «без исполнителя» остаётся ради записей, заведённых до
            того, как поле стало обязательным. */}
        <p className="req-meta">{request.artist || 'без исполнителя'}</p>
        {state.error ? (
          <p className="mt-1 text-sm text-red-300" role="alert">
            {state.error}
          </p>
        ) : null}
      </div>

      {children}
    </li>
  );
}

/** Стрелка вверх — «поднять в очереди». Направление и есть смысл кнопки. */
function ArrowUpIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </svg>
  );
}
