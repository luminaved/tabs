import type { Metadata } from 'next';
import { requireUser } from '@/lib/session';
import { SongEditor } from '@/components/SongEditor';
import { createSongAction } from '../actions';

export const metadata: Metadata = {
  title: 'Новая песня — tabs',
  robots: { index: false, follow: false },
};

export default async function NewSongPage() {
  await requireUser();

  return (
    <main className="container-app py-10">
      <p className="eyebrow mb-2">Новая песня</p>
      <h1 className="display mb-8 text-4xl font-medium">Добавить в песенник</h1>
      <SongEditor action={createSongAction} submitLabel="Сохранить" />
    </main>
  );
}
