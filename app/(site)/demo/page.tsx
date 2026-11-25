import type { Metadata } from 'next';
import Link from 'next/link';
import { SongViewer } from '@/components/SongViewer';
import { INSTRUMENTS, INSTRUMENT_IDS, parseInstrumentId } from '@/lib/chords/instruments';

export const metadata: Metadata = {
  title: 'Демо',
  robots: { index: false, follow: false },
};

const SAMPLE = `{title: Тёплый вечер}
{artist: демо}
{key: G}
{tempo: 92}
{capo: 2}

{start_of_verse}
[G]Свет за [D]окном уже [Em]гаснет, дру[C]зья
[G]мы допо[D]ём этот вечер до [G]дна
{end_of_verse}

{start_of_chorus: Припев}
[C]Пой, пока [G]тянется [D]нить, [Em]пой %(× 2)%
[C]просто ды[D]ши и держись за ак[G]корд
{end_of_chorus}

{comment: медленнее, с чувством}

{start_of_tab: Проигрыш}
e|-----------------0-----|
B|-------0---1-----1-----|
G|---0-------0-----0-----|
D|-2-----2-------2-------|
{end_of_tab}

{start_of_bridge}
[Am]И пусть [D/F#]длинная строчка проверит, как оно переносится на узком экране без единого разрыва слова
{end_of_bridge}`;

/**
 * Площадка рендера страницы песни. Инструмент переключается параметром
 * `?instrument=` — один и тот же текст показывает аппликатуры и для гитары,
 * и для укулеле, поэтому диаграммы обоих строёв видно рядом без создания песни.
 */
export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ instrument?: string }>;
}) {
  const sp = await searchParams;
  const instrument = parseInstrumentId(sp.instrument);

  return (
    <main className="container-app pb-16 pt-8 sm:pb-28">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="eyebrow">Демо страницы песни</p>
        <div className="inst-tabs" role="group" aria-label="Инструмент">
          {INSTRUMENT_IDS.map((id) => (
            <Link
              key={id}
              href={`/demo?instrument=${id}`}
              className={id === instrument ? 'inst-tab inst-tab--on' : 'inst-tab'}
              aria-current={id === instrument ? 'true' : undefined}
            >
              {INSTRUMENTS[id].name}
            </Link>
          ))}
        </div>
      </div>

      <SongViewer
        record={{ body: SAMPLE }}
        instrument={instrument}
        note={'Играть спокойно, на 2/4. Проигрыш после припева — по желанию.'}
        annotations={[
          { id: 'd1', anchor: '7', text: 'Бой: вниз-вниз-вверх-вниз', type: 'rhythm' },
          { id: 'd2', anchor: '12', text: 'Чуть придержать перед припевом', type: 'transition' },
        ]}
      />
    </main>
  );
}
