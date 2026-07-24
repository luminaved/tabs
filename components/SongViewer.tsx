'use client';

import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { ChordSheet } from './ChordSheet';
import { AnnotationForm } from './AnnotationForm';
import { deleteAnnotationAction } from '@/app/(site)/songs/annotations-actions';
import { toggleFavoriteAction, toggleLikeAction } from '@/app/(site)/songs/engagement-actions';
import type { SongEngagement } from '@/lib/engagement';
import type { AnnotationView } from '@/lib/annotations';
import { songFromRecord, type SongRecordLike } from '@/lib/chordpro/fromRecord';
import { transposeSong } from '@/lib/chordpro/transform';
import { transposeKey } from '@/lib/chords/key';

const TYPE_LABEL: Record<string, string> = {
  technique: 'техника',
  rhythm: 'ритм',
  transition: 'переход',
  note: 'заметка',
};

// Размер шрифта текста песни (rem). Дефолт немного уменьшен по просьбе.
const FONT_MIN = 0.8;
const FONT_MAX = 1.7;
const FONT_DEFAULT = 1.12;
const FONT_STEP = 0.1;

export function SongViewer({
  record,
  editHref,
  songId,
  coverUrl,
  note,
  createdAt,
  engagement,
  annotations = [],
  canAnnotate = false,
}: {
  record: SongRecordLike;
  editHref?: string;
  songId?: string;
  coverUrl?: string | null;
  note?: string | null;
  createdAt?: Date;
  engagement?: SongEngagement;
  annotations?: AnnotationView[];
  canAnnotate?: boolean;
}) {
  const createdLabel = createdAt?.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const base = useMemo(() => songFromRecord(record), [record]);

  const [transpose, setTranspose] = useState(0);
  const [capo, setCapo] = useState(record.capo ?? 0);
  const [showChords, setShowChords] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const [speed, setSpeed] = useState(3);
  const [wakeOn, setWakeOn] = useState(false);
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const [fontSize, setFontSize] = useState<number | null>(null);

  const clampFont = (v: number) => Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(v * 100) / 100));

  const byLine = useMemo(() => {
    const map = new Map<number, AnnotationView[]>();
    for (const a of annotations) {
      const n = Number(a.anchor);
      if (!Number.isFinite(n)) continue;
      const arr = map.get(n) ?? [];
      arr.push(a);
      map.set(n, arr);
    }
    return map;
  }, [annotations]);

  const interactive = canAnnotate || annotations.length > 0;

  const wakeSupported =
    typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  // Аппликатуры (формы) = реальное транспонирование минус лад капо. Капо не
  // меняет звучание — только показываемые формы, спелленные по «форменной»
  // тональности. Реальная (звучащая) тональность считается отдельно.
  const shapeSong = useMemo(
    () => transposeSong(base, transpose - capo),
    [base, transpose, capo],
  );
  const realKey = base.meta.key ? transposeKey(base.meta.key, transpose) : null;
  const shapeKey = base.meta.key ? transposeKey(base.meta.key, transpose - capo) : null;

  const offsetLabel = transpose > 0 ? `+${transpose}` : transpose < 0 ? `${transpose}` : '±0';

  // ── Автоскролл ────────────────────────────────────────────────────────────
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const accRef = useRef(0);
  useEffect(() => {
    if (!scrolling) return;
    lastRef.current = performance.now();
    const step = (now: number) => {
      const dt = now - lastRef.current;
      lastRef.current = now;
      accRef.current += speed * 14 * (dt / 1000);
      const px = Math.floor(accRef.current);
      if (px > 0) {
        accRef.current -= px;
        window.scrollBy(0, px);
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 1) {
          setScrolling(false);
          return;
        }
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [scrolling, speed]);

  // ── Wake lock (экран не гаснет) ───────────────────────────────────────────
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  useEffect(() => {
    if (!wakeOn || !wakeSupported) return;
    let cancelled = false;
    const request = async () => {
      try {
        sentinelRef.current = await navigator.wakeLock.request('screen');
      } catch {
        /* отказ (например, вкладка неактивна) — молча игнорируем */
      }
    };
    request();
    const onVisible = () => {
      if (!cancelled && document.visibilityState === 'visible') request();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      sentinelRef.current?.release().catch(() => {});
      sentinelRef.current = null;
    };
  }, [wakeOn, wakeSupported]);

  return (
    <div>
      <header className="mb-6 flex items-start gap-4">
        {coverUrl ? (
          <div className="cover-fill">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverUrl} alt="" className="cover-fill-img" />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="display text-4xl font-medium sm:text-5xl">{base.meta.title ?? 'Без названия'}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted">
            {[
              base.meta.artist,
              base.meta.tempo ? `${base.meta.tempo} bpm` : null,
              createdLabel ? `добавлено ${createdLabel}` : null,
            ]
              .filter(Boolean)
              .map((item, i) => (
                <Fragment key={i}>
                  {i > 0 ? <span className="text-faint">·</span> : null}
                  <span>{item}</span>
                </Fragment>
              ))}
          </p>

          {engagement && songId ? (
            <div className="print-hide mt-3 flex flex-wrap items-center gap-2">
              <form action={toggleLikeAction}>
                <input type="hidden" name="songId" value={songId} />
                <button
                  type="submit"
                  className={`btn h-9 gap-1.5 px-3 text-sm ${engagement.liked ? 'btn-primary' : 'btn-outline'}`}
                  aria-pressed={engagement.liked}
                  title={engagement.liked ? 'Убрать лайк' : 'Лайк'}
                >
                  <HeartIcon filled={engagement.liked} />
                  {engagement.likeCount}
                </button>
              </form>
              <form action={toggleFavoriteAction}>
                <input type="hidden" name="songId" value={songId} />
                <button
                  type="submit"
                  className={`btn h-9 gap-1.5 px-3 text-sm ${engagement.favorited ? 'btn-primary' : 'btn-outline'}`}
                  aria-pressed={engagement.favorited}
                >
                  <BookmarkIcon filled={engagement.favorited} />
                  <span className="hidden sm:inline">
                    {engagement.favorited ? 'В избранном' : 'В избранное'}
                  </span>
                </button>
              </form>
            </div>
          ) : null}
        </div>
        {editHref ? (
          <Link
            href={editHref}
            className="btn btn-outline h-9 shrink-0 self-start gap-2 px-3 text-sm print-hide"
            title="Редактировать"
            aria-label="Редактировать"
          >
            <PencilIcon />
            <span className="hidden sm:inline">Редактировать</span>
          </Link>
        ) : null}
      </header>

      {/* Панель управления */}
      <div className="print-hide sticky top-[3.75rem] z-30 mb-8">
        <div className="toolbar">
          <button
            type="button"
            onClick={() => setTranspose((s) => Math.max(-11, s - 1))}
            className="icon-btn"
            aria-label="Понизить на полутон"
          >
            −
          </button>
          <div className="key-readout">
            <b>{realKey ?? offsetLabel}</b>
            <span>{capo > 0 ? `${offsetLabel} · капо ${capo}` : offsetLabel}</span>
          </div>
          <button
            type="button"
            onClick={() => setTranspose((s) => Math.min(11, s + 1))}
            className="icon-btn"
            aria-label="Повысить на полутон"
          >
            +
          </button>

          <button
            type="button"
            onClick={() => setShowChords((v) => !v)}
            className="btn btn-outline h-10 gap-2 px-3"
            aria-pressed={showChords}
            title={showChords ? 'Скрыть аккорды' : 'Показать аккорды'}
          >
            <EyeIcon off={!showChords} />
            <span className="hidden sm:inline">Аккорды</span>
          </button>

          <button
            type="button"
            onClick={() => setScrolling((v) => !v)}
            className="icon-btn"
            aria-label={scrolling ? 'Остановить автоскролл' : 'Запустить автоскролл'}
            aria-pressed={scrolling}
          >
            {scrolling ? <PauseIcon /> : <PlayIcon />}
          </button>

          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            className="icon-btn ml-auto"
            aria-label="Настройки"
            aria-expanded={settingsOpen}
          >
            <GearIcon />
          </button>
        </div>

        {settingsOpen ? (
          <div className="card mt-2 flex flex-col gap-5 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted">Размер текста</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFontSize((f) => clampFont((f ?? FONT_DEFAULT) - FONT_STEP))}
                  className="icon-btn h-9 w-9 text-sm"
                  aria-label="Меньше"
                >
                  A−
                </button>
                {fontSize !== null ? (
                  <button
                    type="button"
                    onClick={() => setFontSize(null)}
                    className="btn btn-ghost h-9 px-2 text-xs"
                  >
                    сброс
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setFontSize((f) => clampFont((f ?? FONT_DEFAULT) + FONT_STEP))}
                  className="icon-btn h-9 w-9 text-lg"
                  aria-label="Больше"
                >
                  A+
                </button>
              </div>
            </div>

            <label className="flex flex-col gap-2">
              <span className="flex items-center justify-between text-sm">
                <span className="text-muted">Каподастр</span>
                <span className="tabular-nums">
                  {capo > 0 ? `${capo} лад${shapeKey ? ` · формы ${shapeKey}` : ''}` : 'без капо'}
                </span>
              </span>
              <input
                type="range"
                min={0}
                max={11}
                value={capo}
                onChange={(e) => setCapo(Number(e.target.value))}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="flex items-center justify-between text-sm">
                <span className="text-muted">Скорость автоскролла</span>
                <span className="tabular-nums">{speed}</span>
              </span>
              <input
                type="range"
                min={1}
                max={8}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              {wakeSupported ? (
                <button
                  type="button"
                  onClick={() => setWakeOn((v) => !v)}
                  className={wakeOn ? 'btn btn-primary h-9 px-3 text-sm' : 'btn btn-outline h-9 px-3 text-sm'}
                  aria-pressed={wakeOn}
                >
                  {wakeOn ? 'Экран не гаснет: вкл' : 'Не гасить экран'}
                </button>
              ) : null}

              <button type="button" onClick={() => window.print()} className="btn btn-outline h-9 px-3 text-sm">
                Печать / PDF
              </button>

              {(transpose !== 0 || capo !== (record.capo ?? 0)) ? (
                <button
                  type="button"
                  onClick={() => {
                    setTranspose(0);
                    setCapo(record.capo ?? 0);
                  }}
                  className="btn btn-ghost h-9 px-2 text-sm"
                >
                  Сбросить
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {note ? (
        <div className="song-note">
          <span className="song-note-label">От автора</span>
          <p className="song-note-text">{note}</p>
        </div>
      ) : null}

      {canAnnotate ? (
        <p className="print-hide mb-3 text-sm text-faint">
          Нажмите на строку, чтобы добавить заметку.
        </p>
      ) : null}

      <div
        className="print-area"
        style={
          fontSize !== null ? ({ '--sheet-font-size': `${fontSize}rem` } as CSSProperties) : undefined
        }
      >
        <ChordSheet
          song={shapeSong}
          showChords={showChords}
          interaction={
            interactive
              ? {
                  onLineClick: canAnnotate
                    ? (l) => setActiveLine((cur) => (cur === l ? null : l))
                    : undefined,
                  activeLine,
                  lineExtras: (line) => {
                    const notes = byLine.get(line) ?? [];
                    const isActive = activeLine === line;
                    if (notes.length === 0 && !(isActive && canAnnotate)) return null;
                    return (
                      <div className="cs-notes">
                        {notes.map((n) => (
                          <div key={n.id} className="cs-note">
                            {n.type ? (
                              <span className="cs-note-type">{TYPE_LABEL[n.type] ?? n.type}</span>
                            ) : null}
                            <span className="cs-note-text">{n.text}</span>
                            {canAnnotate && songId ? (
                              <form action={deleteAnnotationAction} className="print-hide ml-auto">
                                <input type="hidden" name="id" value={n.id} />
                                <input type="hidden" name="songId" value={songId} />
                                <button
                                  type="submit"
                                  className="cs-note-del"
                                  aria-label="Удалить заметку"
                                  title="Удалить"
                                >
                                  ×
                                </button>
                              </form>
                            ) : null}
                          </div>
                        ))}
                        {isActive && canAnnotate && songId ? (
                          <AnnotationForm
                            songId={songId}
                            anchor={String(line)}
                            onDone={() => setActiveLine(null)}
                          />
                        ) : null}
                      </div>
                    );
                  },
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      {off ? <line x1="3" y1="3" x2="21" y2="21" /> : null}
    </svg>
  );
}
function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M7 5v14l12-7z" />
    </svg>
  );
}
function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}
function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}
function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
