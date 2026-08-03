import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { currentUserIsAdmin } from '@/lib/admin';
import { getAdminStats, type Delta, type TopSong } from '@/lib/stats';
import { INSTRUMENTS } from '@/lib/chords/instruments';
import { songPath } from '@/lib/slug';
import { TrendChart } from '@/components/charts/TrendChart';
import { BarList } from '@/components/charts/BarList';
import { Meter, ShareBar } from '@/components/charts/ShareBar';

export const metadata: Metadata = {
  title: 'Статистика',
  robots: { index: false, follow: false },
};

/**
 * Статистика сайта — только для администратора.
 *
 * Не тем, у кого нет прав, отдаём 404, а не редирект на вход: редирект
 * подтвердил бы, что страница существует. Роль лежит в БД, а не в токене
 * (см. lib/admin.ts), поэтому выданные права действуют сразу.
 *
 * Страница читается сверху вниз как ответ на три вопроса: что происходит сейчас
 * (главные числа с изменением к прошлой неделе), как менялось за месяц
 * (графики) и что внутри — состав библиотеки и топы.
 */
export default async function AdminStatsPage() {
  if (!(await currentUserIsAdmin())) notFound();

  const s = await getAdminStats();
  const sum = (points: { value: number }[]) => points.reduce((a, p) => a + p.value, 0);

  return (
    <main className="container-app py-10">
      <div className="mb-8">
        <p className="eyebrow mb-2">Только для администратора</p>
        <h1 className="display text-4xl font-medium">Статистика</h1>
      </div>

      <AuthProvidersState />

      {/* ── Главное: числа, каждое со сравнением к прошлой неделе ────────── */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-medium">Сейчас</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <HeadlineTile
            label="Аккаунтов"
            value={s.users.total}
            delta={s.users.weekDelta}
            deltaLabel="за 7 дней"
          />
          <HeadlineTile
            label="Разборов"
            value={s.songs.total}
            delta={s.songs.weekDelta}
            deltaLabel="за 7 дней"
          />
          <HeadlineTile label="Просмотров" value={s.engagement.views} />
        </div>
      </section>

      {/* ── Динамика за месяц ───────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-medium">За {s.trends.days} дней</h2>
        <div className="flex flex-col gap-4">
          <TrendChart title="Новые аккаунты" points={s.trends.users} total={sum(s.trends.users)} />
          <TrendChart title="Новые разборы" points={s.trends.songs} total={sum(s.trends.songs)} />
          <TrendChart
            title="Отметки о просмотре"
            points={s.trends.views}
            total={sum(s.trends.views)}
            caption="Это не число просмотров за день. Отметка одна на пару «зритель + разбор», и повторный заход двигает ей дату — поэтому свежие дни точны, а чем день старше, тем сильнее он занижен."
          />
        </div>
      </section>

      {/* ── Состав библиотеки ───────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-medium">Библиотека</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ShareBar
            title="Видимость разборов"
            parts={[
              { key: 'public', label: 'Публичные', value: s.songs.visibility.public ?? 0 },
              { key: 'unlisted', label: 'По ссылке', value: s.songs.visibility.unlisted ?? 0 },
              { key: 'private', label: 'Приватные', value: s.songs.visibility.private ?? 0 },
            ]}
          />
          <div className="chart-card">
            <div className="chart-head">
              <span className="chart-title">Наполненность</span>
            </div>
            <Meter
              label="Подтверждено модератором"
              value={s.songs.verified}
              total={s.songs.total}
            />
            <Meter label="С обложкой" value={s.songs.withCover} total={s.songs.total} />
            <Meter
              label={INSTRUMENTS.ukulele.name}
              value={s.songs.instrument.ukulele}
              total={s.songs.total}
              hint={`Остальные — ${INSTRUMENTS.guitar.name.toLowerCase()}: ${s.songs.instrument.guitar.toLocaleString('ru-RU')}`}
            />
          </div>
        </div>
      </section>

      {/* ── Топы ────────────────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-medium">Топы</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <BarList
            title="Больше всего просмотров"
            unit="просмотры"
            items={toBars(s.topByViews, (song) => song.viewCount)}
            empty="Публичных разборов пока нет."
          />
          <BarList
            title="Больше всего лайков"
            unit="лайки"
            items={toBars(s.topByLikes, (song) => song.likes)}
            empty="Публичных разборов пока нет."
          />
          <BarList
            title="Авторы"
            unit="разборы"
            items={s.topAuthors.map((a) => ({
              id: a.id,
              label: a.name || 'Без имени',
              value: a.songs,
              href: `/u/${a.id}`,
            }))}
            empty="Публичных разборов пока нет."
          />
          <div className="chart-card">
            <div className="chart-head">
              <span className="chart-title">Отклик</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Tile label="Лайков" value={s.engagement.likes} />
              <Tile label="В избранном" value={s.engagement.favorites} />
              <Tile label="Заметок" value={s.engagement.annotations} />
              <Tile label="Сетлистов" value={s.engagement.setlists} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Аккаунты: состав ────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-medium">Аккаунты</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Tile label="За 30 дней" value={s.users.month} />
          <Tile label="С паролем" value={s.users.withPassword} />
          <Tile label="Через Google" value={s.users.googleAccounts} />
          <Tile label="Администраторов" value={s.users.admins} />
        </div>
      </section>

      {/* Расхождение счётчика и отметок — единственное место, где видно
          накрутку скриптом (scripts/seed-views.mjs). Оставлено на виду. */}
      <p className="text-sm text-faint">
        Отметок о просмотре: {s.engagement.viewRows.toLocaleString('ru-RU')} — из них гостевых{' '}
        {s.engagement.guestViewRows.toLocaleString('ru-RU')}, с аккаунтов{' '}
        {s.engagement.accountViewRows.toLocaleString('ru-RU')}. Отметка одна на зрителя и разбор,
        поэтому их всегда меньше, чем просмотров. Большой разрыв означает, что счётчик поднимали
        скриптом.
      </p>
    </main>
  );
}

/**
 * Состояние способов входа: что настроено, а что нет.
 *
 * Заведено после того, как вход через Telegram не появлялся на боевом сервере,
 * а понять почему было нельзя: компонент кнопки просто возвращает null, и
 * снаружи «переменную не завели», «завели не в то окружение» и «опечатались в
 * имени» выглядят одинаково — пустым местом. Каждая догадка стоила деплоя.
 *
 * Показываются ТОЛЬКО факты наличия, никогда сами значения: токен бота — это
 * полный доступ к нему, а секрет провайдера — к входу. Страница админская, но
 * секретам всё равно незачем появляться в разметке.
 */
function AuthProvidersState() {
  const rows = [
    { name: 'Google', vars: { AUTH_GOOGLE_ID: !!process.env.AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET: !!process.env.AUTH_GOOGLE_SECRET } },
    { name: 'Яндекс', vars: { AUTH_YANDEX_ID: !!process.env.AUTH_YANDEX_ID, AUTH_YANDEX_SECRET: !!process.env.AUTH_YANDEX_SECRET } },
    { name: 'Telegram', vars: { TELEGRAM_BOT_TOKEN: !!process.env.TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_NAME: !!process.env.TELEGRAM_BOT_NAME } },
  ];

  return (
    <section className="mb-10">
      <h2 className="mb-3 text-lg font-medium">Способы входа</h2>
      <ul className="flex flex-col gap-2">
        {rows.map((r) => {
          const missing = Object.entries(r.vars).filter(([, set]) => !set);
          const on = missing.length === 0;
          return (
            <li key={r.name} className="card flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
              <span className={on ? 'text-accent' : 'text-faint'}>{on ? '✓' : '—'}</span>
              <span className="font-medium">{r.name}</span>
              <span className="text-sm text-muted">
                {on ? 'настроен' : `не хватает: ${missing.map(([k]) => k).join(', ')}`}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-sm text-faint">
        Значения переменных здесь не показываются — только сам факт, что они заданы.
      </p>
    </section>
  );
}

function toBars(songs: TopSong[], pick: (s: TopSong) => number) {
  return songs.map((song) => ({
    id: song.id,
    label: song.title,
    sub: song.artist,
    value: pick(song),
    href: songPath(song),
  }));
}

/** Главное число: величина плюс изменение к прошлой неделе. */
function HeadlineTile({
  label,
  value,
  delta,
  deltaLabel,
}: {
  label: string;
  value: number;
  delta?: Delta;
  deltaLabel?: string;
}) {
  return (
    <div className="stat-tile">
      <span className="stat-value stat-value--accent">{value.toLocaleString('ru-RU')}</span>
      <span className="stat-label">{label}</span>
      {delta && deltaLabel ? <DeltaBadge delta={delta} label={deltaLabel} /> : null}
    </div>
  );
}

/**
 * Изменение к прошлой неделе. Стрелка и подпись идут вместе с цветом — цвет
 * здесь не единственный ключ, иначе рост и падение различались бы только им.
 */
function DeltaBadge({ delta, label }: { delta: Delta; label: string }) {
  const { current, previous, percent } = delta;
  const dir = current > previous ? 'up' : current < previous ? 'down' : 'flat';
  const arrow = dir === 'up' ? '↑' : dir === 'down' ? '↓' : '→';

  return (
    <span className={`delta delta--${dir}`}>
      <span aria-hidden>{arrow}</span>
      <span>
        {current.toLocaleString('ru-RU')} {label}
        {percent !== null && percent !== 0 ? (
          <span className="text-faint">
            {' '}
            ({percent > 0 ? '+' : ''}
            {percent}% к прошлой)
          </span>
        ) : previous === 0 && current > 0 ? (
          <span className="text-faint"> (неделей раньше — ноль)</span>
        ) : null}
      </span>
    </span>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat-tile">
      <span className="stat-value">{value.toLocaleString('ru-RU')}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}
