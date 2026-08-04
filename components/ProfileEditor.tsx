'use client';

import { useActionState, useEffect, useState } from 'react';
import { updateProfileAction } from '@/app/(site)/account/actions';
import { Avatar } from './Avatar';
import { AvatarInput } from './AvatarInput';

/**
 * Карточка аккаунта в кабинете: кто вы, куда отсюда можно уйти и кнопка
 * настроек.
 *
 * Раньше это была форма и ничего кроме формы: поле «Отображаемое имя» с кнопкой
 * «Сохранить» стояло открытым всегда, хотя имя меняют примерно однажды, а
 * «Публичный профиль» и «Выйти» ютились сверху серым текстом. Получалось
 * наоборот: постоянная работа — уйти в свои песни или в публичный профиль —
 * выглядела мельче, чем разовая.
 *
 * Теперь наверху карточки — кто вы, под ней ряд действий, а всё редактируемое
 * (фото и имя) спрятано за «Настройками». Фото ушло туда же не за компанию: оно
 * и есть вторая половина этой формы, а редактировать половину при закрытой
 * второй нечем — сохранять было бы нечем.
 *
 * `actions` и `exit` приходят готовой разметкой со страницы: там серверные
 * ссылки и форма выхода с серверным экшеном, клиенту про них знать нечего.
 */
export function ProfileEditor({
  userId,
  name,
  email,
  avatarVersion,
  memberSince,
  actions,
  exit,
}: {
  userId: string;
  name: string;
  /** Может отсутствовать: у старых аккаунтов без почты (см. schema.prisma). */
  email: string | null;
  /** Отпечаток аватара для ссылки на /avatars/[id]; null — аватара нет. */
  avatarVersion: string | null;
  memberSince: string;
  /** Переходы: публичный профиль, статистика администратору. */
  actions: React.ReactNode;
  /** Форма выхода. Отдельно от `actions`, чтобы встать последней в списке. */
  exit: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(updateProfileAction, {});
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (state.ok) {
      setSaved(true);
      const t = setTimeout(() => setSaved(false), 2500);
      return () => clearTimeout(t);
    }
  }, [state]);

  return (
    <section className="card flex flex-col gap-5 p-5 sm:p-6">
      <div className="flex items-center gap-4">
        <Avatar
          userId={userId}
          version={avatarVersion}
          name={name}
          email={email}
          size={64}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-medium">{name || 'Без имени'}</p>
          <p className="truncate text-sm text-muted">
            {email ?? 'Вход без электронной почты'}
          </p>
          <p className="mt-0.5 text-xs text-faint">аккаунт с {memberSince}</p>
        </div>
      </div>

      {/* Порядок здесь, а не на странице: «Выйти» обязан стоять последним, а
          «Настройки» — рядом с остальными переходами, между ними. */}
      <div className="account-actions">
        {actions}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`btn btn-outline h-11 gap-2.5 px-3.5 text-sm${open ? ' btn-toggled' : ''}`}
          aria-expanded={open}
        >
          <GearIcon />
          Настройки
        </button>
        {exit}
      </div>

      {open ? (
        <form action={formAction} className="account-settings flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <AvatarInput userId={userId} version={avatarVersion} name={name} email={email} size={80} />
            <div className="min-w-0 text-sm">
              <p className="font-medium">Фото профиля</p>
              <p className="mt-0.5 text-muted">
                Нажмите на аватар: карандаш — выбрать файл, крестик — убрать.
              </p>
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-muted">Отображаемое имя</span>
            <input name="name" defaultValue={name} placeholder="Ваше имя" className="field" />
            <span className="text-xs text-faint">
              Видно всем: в публичном профиле и под вашими разборами.
            </span>
          </label>

          {state.error ? (
            <p
              className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300"
              role="alert"
            >
              {state.error}
            </p>
          ) : null}

          <div className="flex items-center gap-3">
            <button type="submit" disabled={pending} className="btn btn-primary h-10 px-5 text-sm">
              {pending ? 'Сохраняем…' : 'Сохранить'}
            </button>
            {/* role="status" — иначе подтверждение видит только зрячий. */}
            {saved ? (
              <span className="text-sm text-accent" role="status">
                ✓ Сохранено
              </span>
            ) : null}
          </div>
        </form>
      ) : null}
    </section>
  );
}

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
