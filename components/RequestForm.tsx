'use client';

import { useActionState, useEffect, useRef } from 'react';
import { INSTRUMENT_IDS, INSTRUMENTS, type InstrumentId } from '@/lib/chords/instruments';
import { requestSongAction, type RequestFormState } from '@/app/(site)/requests/actions';

/**
 * Форма заявки на разбор.
 *
 * Полей ровно два с половиной, и это главное решение: чем длиннее форма, тем
 * меньше заявок, а нужны как раз они — заявка и есть сигнал спроса. Поля для
 * комментария нет вовсе (см. схему: публиковать чужой произвольный текст —
 * значит завести себе доску объявлений и ручную модерацию).
 *
 * Вход не требуется. Иначе форму заполняли бы единицы, и весь смысл затеи —
 * узнать, что искали пришедшие из поиска, — пропал бы.
 */
export function RequestForm({ instrument = 'guitar' }: { instrument?: InstrumentId }) {
  const [state, action, pending] = useActionState<RequestFormState, FormData>(
    requestSongAction,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  // После успеха очищаем поля: следующая заявка начинается с чистого листа, а
  // оставшийся в поле текст легко отправить повторно, не заметив.
  useEffect(() => {
    if (state.done) formRef.current?.reset();
  }, [state.done]);

  return (
    <form ref={formRef} action={action} className="card flex flex-col gap-3 p-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm text-muted">Песня</span>
          <input
            name="title"
            required
            maxLength={120}
            placeholder="Название"
            className="field"
            autoComplete="off"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm text-muted">Исполнитель</span>
          {/* Обязателен: без исполнителя заявка склеивается с любой песней того
              же названия — и как дубль, и при проверке «а не разобрали ли уже»
              (см. requestMatchKey и findFulfilled). Настоящая проверка стоит
              в экшене, здесь только подсказка браузера. */}
          <input
            name="artist"
            required
            maxLength={120}
            placeholder="Кто исполняет"
            className="field"
            autoComplete="off"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-sm text-muted">Инструмент</legend>
          {/* Radio спрятан, а подсвечивается сам ярлык — правило
              `.inst-tab:has(input:checked)` в globals.css. Так переключатель
              выглядит как вкладки инструментов в каталоге, но остаётся обычной
              формой и работает без JS. */}
          <div className="inst-tabs" role="radiogroup">
            {INSTRUMENT_IDS.map((id) => (
              <label key={id} className="inst-tab cursor-pointer">
                <input
                  type="radio"
                  name="instrument"
                  value={id}
                  defaultChecked={id === instrument}
                  className="sr-only"
                />
                {INSTRUMENTS[id].name}
              </label>
            ))}
          </div>
        </fieldset>

        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? 'Отправляем…' : 'Запросить разбор'}
        </button>
      </div>

      {state.error ? (
        <p
          className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      {/* Три исхода значат для человека разное, и объединять их в «спасибо»
          нельзя: он должен понимать, завёл ли новую заявку или поддержал чужую. */}
      {state.done === 'created' ? (
        <p className="text-sm text-accent" role="status">
          Заявка добавлена. Если наберёт голоса — разберём в первую очередь.
        </p>
      ) : null}
      {state.done === 'voted' ? (
        <p className="text-sm text-accent" role="status">
          Эту песню уже просили — ваш голос засчитан.
        </p>
      ) : null}
      {state.done === 'known' ? (
        <p className="text-sm text-muted" role="status">
          Вы уже просили эту песню. Она в списке.
        </p>
      ) : null}
    </form>
  );
}
