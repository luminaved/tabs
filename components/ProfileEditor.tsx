'use client';

import { useActionState, useEffect, useState } from 'react';
import { updateProfileAction } from '@/app/(site)/account/actions';
import { AvatarInput } from './AvatarInput';

export function ProfileEditor({
  name,
  email,
  image,
  memberSince,
}: {
  name: string;
  email: string;
  image: string | null;
  memberSince: string;
}) {
  const [state, formAction, pending] = useActionState(updateProfileAction, {});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (state.ok) {
      setSaved(true);
      const t = setTimeout(() => setSaved(false), 2000);
      return () => clearTimeout(t);
    }
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <AvatarInput initial={image} name={name} email={email} />
        <div className="min-w-0">
          <p className="truncate text-lg font-medium">{name || 'Без имени'}</p>
          <p className="truncate text-muted">{email}</p>
          <p className="mt-0.5 text-sm text-faint">аккаунт с {memberSince}</p>
        </div>
      </div>

      <div className="flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-sm text-muted">Отображаемое имя</span>
          <input name="name" defaultValue={name} placeholder="Ваше имя" className="field" />
        </label>
        <button type="submit" disabled={pending} className="btn btn-outline h-[2.9rem] px-4">
          {pending ? '…' : 'Сохранить'}
        </button>
        {saved ? <span className="pb-3.5 text-sm text-accent">✓</span> : null}
      </div>
    </form>
  );
}
