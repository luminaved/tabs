'use client';

import { useActionState, useEffect, useRef } from 'react';
import { createAnnotationAction } from '@/app/(site)/songs/annotations-actions';

export function AnnotationForm({
  songId,
  anchor,
  onDone,
}: {
  songId: string;
  anchor: string;
  onDone?: () => void;
}) {
  const [state, formAction, pending] = useActionState(createAnnotationAction, {});
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      ref.current?.reset();
      onDone?.();
    }
  }, [state.ok, onDone]);

  return (
    <form ref={ref} action={formAction} className="cs-note-form">
      <input type="hidden" name="songId" value={songId} />
      <input type="hidden" name="anchor" value={anchor} />
      <select name="type" defaultValue="note" className="field h-9 w-28 text-sm" aria-label="Тип заметки">
        <option value="note">заметка</option>
        <option value="technique">техника</option>
        <option value="rhythm">ритм</option>
        <option value="transition">переход</option>
      </select>
      <input
        name="text"
        autoFocus
        placeholder="Заметка к этой строке"
        className="field h-9 flex-1 text-sm"
      />
      <button type="submit" disabled={pending} className="btn btn-primary h-9 px-3 text-sm">
        {pending ? '…' : 'Добавить'}
      </button>
      {state.error ? (
        <span className="w-full text-sm text-red-300" role="alert">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
