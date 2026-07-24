'use client';

import { deleteSongAction } from '@/app/(site)/songs/actions';

export function DeleteSongForm({ id }: { id: string }) {
  return (
    <form
      action={deleteSongAction}
      onSubmit={(e) => {
        if (!confirm('Удалить песню безвозвратно?')) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="btn btn-ghost px-2 text-sm text-red-400 hover:text-red-300">
        Удалить песню
      </button>
    </form>
  );
}
