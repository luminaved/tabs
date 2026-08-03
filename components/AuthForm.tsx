'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { googleSignInAction, yandexSignInAction, type AuthFormState } from '@/app/(auth)/actions';

type Action = (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;

export function AuthForm({
  action,
  title,
  subtitle,
  submitLabel,
  withName = false,
  notice,
  footer,
  telegram,
}: {
  action: Action;
  title: string;
  subtitle: string;
  submitLabel: string;
  withName?: boolean;
  notice?: string;
  footer: React.ReactNode;
  /**
   * Кнопка Telegram. Готовым узлом от страницы, потому что собирает её
   * серверный компонент: в адресе входа участвует токен бота, а он серверный.
   */
  telegram?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col justify-center gap-9 px-6 py-16">
      <div className="flex flex-col gap-6">
        <Link href="/" className="wordmark self-start text-lg">
          <span className="wordmark-accent">Raw</span>Chords
        </Link>
        <div className="flex flex-col gap-2">
          <h1 className="display text-4xl font-medium">{title}</h1>
          <p className="text-muted">{subtitle}</p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {notice ? (
          <p
            className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-200"
            role="status"
          >
            {notice}
          </p>
        ) : null}
        {/* Кнопки показываются всегда, даже без настроенных кредов: экшен в
            этом случае вернёт человека сюда с понятным объяснением. Так
            компонент остаётся клиентским и ничего не знает про окружение —
            тот же приём, что был заведён для Google. */}
        <form action={yandexSignInAction}>
          <button type="submit" className="btn btn-outline h-11 w-full gap-2.5">
            <YandexIcon />
            Продолжить с Яндексом
          </button>
        </form>
        <form action={googleSignInAction}>
          <button type="submit" className="btn btn-outline h-11 w-full gap-2.5">
            <GoogleIcon />
            Продолжить с Google
          </button>
        </form>
        {/* Кнопка Telegram теперь наша и той же формы, что соседние, поэтому
            стоит в общем ряду без обёрток. Приходит готовым узлом от страницы:
            адрес входа собирается на сервере из токена бота. */}
        {telegram}
        <div className="flex items-center gap-3 text-xs text-faint">
          <span className="h-px flex-1 bg-[var(--color-line)]" />
          или
          <span className="h-px flex-1 bg-[var(--color-line)]" />
        </div>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        {withName ? (
          <Field label="Имя (необязательно)">
            <input name="name" type="text" autoComplete="name" className="field" />
          </Field>
        ) : null}

        <Field label="Email">
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            autoFocus
            placeholder="you@example.com"
            className="field"
          />
        </Field>

        <Field label="Пароль">
          <input
            name="password"
            type="password"
            required
            autoComplete={withName ? 'new-password' : 'current-password'}
            placeholder={withName ? 'минимум 8 символов' : '••••••••'}
            className="field"
          />
        </Field>

        {state.error ? (
          <p
            className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300"
            role="alert"
          >
            {state.error}
          </p>
        ) : null}

        <button type="submit" disabled={pending} className="btn btn-primary mt-2 h-12">
          {pending ? '…' : submitLabel}
        </button>
      </form>

      <p className="text-sm text-muted">{footer}</p>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-muted">{label}</span>
      {children}
    </label>
  );
}

/** Логотип Яндекса: «Я» на фирменном красном круге. */
function YandexIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#FC3F1D" />
      <path
        fill="#fff"
        d="M13.06 19.2h2.2V4.8h-3.2c-3.22 0-4.92 1.65-4.92 4.09 0 1.95.93 3.1 2.58 4.28L6.85 19.2h2.38l3.18-4.75-1.1-.74c-1.34-.9-2-1.6-2-3.11 0-1.33.93-2.23 2.7-2.23h1.05V19.2z"
      />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.6 2.4-7.2 2.4-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.6 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C41.4 35.9 44 30.4 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}
