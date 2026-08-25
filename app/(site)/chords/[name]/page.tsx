import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import {
  chordSlug,
  listCatalogChords,
  listSongsWithChord,
  shapesForChord,
  type ChordEntry,
} from '@/lib/chords/chordPages';
import { getInstrument, stringsLabel } from '@/lib/chords/instruments';
import { fretWindow } from '@/lib/chords/diagrams';
import { SITE_NAME } from '@/lib/site';
import { breadcrumbJsonLd, itemListJsonLd, type Crumb } from '@/lib/seo';
import { jsonLdScript } from '@/lib/jsonLd';
import { songPath } from '@/lib/slug';
import { withPluralRu } from '@/lib/plural';
import { ChordCard } from '@/components/ChordCard';
import { SongRow } from '@/components/SongRow';
import { EAGER_THUMBS } from '@/components/SongThumb';
import { Breadcrumbs } from '@/components/Breadcrumbs';

/**
 * Страница одного аккорда.
 *
 * Что здесь есть такого, чего нет у справочников в выдаче: форма СРАЗУ для
 * гитары и укулеле, живые разборы сайта с этим аккордом и — у квинт — запись
 * «лад + В/Н» из русских табов, которую в поиске не объясняет никто.
 *
 * Страницы заводятся только под аккорды каталога (см. lib/chords/chordPages.ts):
 * страница про аккорд, которого нет ни в одном разборе, показать может только
 * картинку и потому была бы дорвеем.
 */

/** Находит аккорд по адресу: канонический — как есть, чужое написание — с 308. */
async function resolve(slug: string): Promise<{ entry: ChordEntry; redirect: string | null }> {
  const all = await listCatalogChords();

  const canonical = all.find((c) => c.slug === slug.toLowerCase());
  if (canonical) return { entry: canonical, redirect: null };

  // Энгармоника: «/chords/b-flat-5» ведёт на «/chords/a-sharp-5», если в
  // каталоге чаще пишут через диез. Один аккорд — один адрес.
  const alias = all.find((c) => c.aliases.some((a) => chordSlug(a) === slug.toLowerCase()));
  if (alias) return { entry: alias, redirect: `/chords/${alias.slug}` };

  notFound();
}

function chordTitle(name: string): string {
  return `Аккорд ${name} на гитаре и укулеле — аппликатуры и песни`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  const { name: slug } = await params;
  const { entry } = await resolve(slug);
  const alsoKnown = entry.aliases.length ? ` Он же ${entry.aliases.join(', ')}.` : '';

  const title = chordTitle(entry.name);
  const description =
    `Как ставить аккорд ${entry.name}: схемы аппликатур для гитары и укулеле, ` +
    `позиция на грифе.${alsoKnown} ` +
    `${withPluralRu(entry.count, 'разбор', 'разбора', 'разборов')} с этим аккордом на ${SITE_NAME}.`;

  return {
    title,
    description,
    alternates: { canonical: `/chords/${entry.slug}` },
    openGraph: {
      type: 'article',
      url: `/chords/${entry.slug}`,
      siteName: SITE_NAME,
      locale: 'ru_RU',
      title,
      description,
    },
  };
}

export default async function ChordPage({ params }: { params: Promise<{ name: string }> }) {
  const { name: slug } = await params;
  const { entry, redirect } = await resolve(slug);
  if (redirect) permanentRedirect(redirect);

  const names = [entry.name, ...entry.aliases];
  // Формы считаются в памяти, а песни идут в БД — ждать нужно только их.
  const shapes = shapesForChord(entry.name);
  const songs = await listSongsWithChord(names);

  const path = `/chords/${entry.slug}`;
  const crumbs: Crumb[] = [
    { name: 'Аккорды', path: '/chords' },
    { name: entry.name, path },
  ];

  // Гитарная квинта: та самая запись «лад + В/Н», ради которой раздел и нужен.
  const guitar = shapes.find((s) => s.instrument === 'guitar');
  const fretLabel = entry.power ? (guitar?.fretLabel ?? null) : null;

  return (
    <main className="container-app py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd(crumbs)) }}
      />
      {songs.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdScript(
              itemListJsonLd(
                songs.map((s) => ({
                  name: `${s.title}${s.artist ? ` — ${s.artist}` : ''}`,
                  path: songPath(s),
                })),
                `Разборы с аккордом ${entry.name}`,
              ),
            ),
          }}
        />
      ) : null}

      <Breadcrumbs crumbs={crumbs} />

      <header className="mb-8">
        <p className="eyebrow mb-2">{entry.power ? 'Квинта' : 'Аккорд'}</p>
        <h1 className="display text-3xl font-medium sm:text-4xl">
          Аккорд {entry.name} на гитаре и укулеле
        </h1>
        <p className="mt-2 text-muted">
          {entry.aliases.length > 0 ? (
            <>
              Он же {entry.aliases.join(', ')} — та же высота, другое написание.{' '}
            </>
          ) : null}
          {entry.count > 0
            ? `В каталоге ${withPluralRu(entry.count, 'разбор', 'разбора', 'разборов')} с этим аккордом.`
            : null}
        </p>
      </header>

      {/* ── Аппликатуры ───────────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-medium">Аппликатуры</h2>
        <div className="flex flex-wrap gap-4">
          {shapes.map(({ instrument, shape }) => {
            const inst = getInstrument(instrument);
            const window = shape ? fretWindow(shape.frets) : null;
            return (
              <div key={instrument} className="card flex flex-col items-center gap-2 px-5 py-4">
                <span className="text-sm text-muted">
                  {inst.name} · {stringsLabel(inst.strings)}
                </span>
                <ChordCard name={entry.name} instrument={inst} size={104} />
                {shape ? (
                  <span className="text-xs text-faint">
                    {window && window.base > 1 ? `с ${window.base} лада` : 'от порожка'} · строй{' '}
                    {inst.labels.join('')}
                  </span>
                ) : (
                  <span className="text-xs text-faint">форма не задана</span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Запись «лад + В/Н» ────────────────────────────────────────────── */}
      {fretLabel ? (
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-medium">
            {entry.name} в русских табах — это «{fretLabel}»
          </h2>
          <div className="card flex flex-col gap-3 px-5 py-4 text-sm leading-relaxed text-muted">
            <p>
              В табах, которые ходят по сети со времён форумов, квинты часто записывают не
              буквой, а ладом и струной: <b className="text-fg">{fretLabel}</b> вместо{' '}
              <b className="text-fg">{entry.name}</b>. Цифра — лад, на котором стоит корень,
              буква — струна: <b className="text-fg">В</b> значит шестую (верхнюю),{' '}
              <b className="text-fg">Н</b> — пятую (на струну тоньше). Форма при этом одна и та
              же: корень, а двумя ладами выше — квинта и её октава.
            </p>
            <p>
              Запись понятна тому, кто на ней вырос, но у неё есть цена: она называет позицию, а
              не высоту, поэтому такой аккорд <b className="text-fg">не транспонируется</b> — при
              смене тональности он остаётся на месте, пока остальные едут. Поэтому в разборах мы
              храним стандартное имя, а привычную запись показываем по переключателю в настройках
              читалки: она меняет подпись, но не двигает аппликатуру.
            </p>
          </div>
        </section>
      ) : null}

      {/* ── Разборы с этим аккордом ───────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-lg font-medium">
          {songs.length > 0 ? `Песни с аккордом ${entry.name}` : 'Разборов пока нет'}
        </h2>
        {songs.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {songs.map((song, i) => (
              <li key={song.id}>
                <SongRow song={song} priority={i < EAGER_THUMBS} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">
            Этот аккорд встречается в каталоге, но подходящих разборов не нашлось.{' '}
            <Link href="/chords" className="hover:underline">
              Все аккорды
            </Link>
          </p>
        )}
      </section>

      <p className="mt-8 text-sm text-muted">
        <Link href="/chords" className="hover:text-fg hover:underline">
          ← Все аккорды каталога
        </Link>
      </p>
    </main>
  );
}
