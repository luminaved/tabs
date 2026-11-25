import type { Metadata } from 'next';
import { requireUser } from '@/lib/session';
import { SongEditor } from '@/components/SongEditor';
import { parseInstrumentId } from '@/lib/chords/instruments';
import { createSongAction } from '../actions';

export const metadata: Metadata = {
  title: 'Новая песня',
  robots: { index: false, follow: false },
};

export default async function NewSongPage({
  searchParams,
}: {
  searchParams: Promise<{ instrument?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  // Инструмент приходит из библиотеки, откуда нажали «Новая», — чтобы не
  // выбирать его заново. Значение всё равно нормализуется.
  const instrument = parseInstrumentId(sp.instrument);

  return (
    <main className="container-app py-10">
      <p className="eyebrow mb-2">Новая песня</p>
      <h1 className="display mb-8 text-4xl font-medium">Добавить в песенник</h1>
      <SongEditor action={createSongAction} submitLabel="Сохранить" initial={{ instrument }} />
    </main>
  );
}
