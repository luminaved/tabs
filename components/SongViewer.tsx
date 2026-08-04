'use client';

import {
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
} from 'react';
import Link from 'next/link';
import { ChordSheet } from './ChordSheet';
import { ChordCard } from './ChordCard';
import { InlineChord } from './InlineChord';
import { AnnotationForm } from './AnnotationForm';
import { ShareButton } from './ShareButton';
import { chordsFromSong } from '@/lib/chordpro/usedChords';
import type { ChordShape } from '@/lib/chords/diagrams';
import { getInstrument, type InstrumentId } from '@/lib/chords/instruments';
import { deleteAnnotationAction } from '@/app/(site)/songs/annotations-actions';
import { toggleFavoriteAction, toggleLikeAction } from '@/app/(site)/songs/engagement-actions';
import { toggleVerifiedAction } from '@/app/(site)/songs/verify-actions';
import { VerifiedBadge, VERIFIED_TITLE } from './VerifiedBadge';
import type { SongEngagement } from '@/lib/engagement';
import type { AnnotationView } from '@/lib/annotations';
import {
  readBoolPref,
  readIntPref,
  readNumberPref,
  viewerKeys,
  writePref,
} from '@/lib/viewerPrefs';
import { songFromRecord, type SongRecordLike } from '@/lib/chordpro/fromRecord';
import { transposeSong } from '@/lib/chordpro/transform';
import { transposeKey } from '@/lib/chords/key';

const TYPE_LABEL: Record<string, string> = {
  technique: 'техника',
  rhythm: 'ритм',
  transition: 'переход',
  note: 'заметка',
};

/**
 * Подпись типа над заметкой — либо null, если подписывать нечего.
 *
 * У обычной заметки подписи нет намеренно: слово «заметка» над заметкой не
 * сообщает читателю ничего, а строчку капсом и её вес в потоке песни занимает.
 * «Техника», «ритм» и «переход» — другое дело: там подпись и есть содержание,
 * она говорит, к чему относится текст. Само значение в БД не трогаем — прячем
 * только показ.
 */
function noteTypeLabel(type?: string | null): string | null {
  if (!type || type === 'note') return null;
  return TYPE_LABEL[type] ?? type;
}

// Размер шрифта текста песни (rem).
//
// FONT_DEFAULT — не то, чем страница рисуется по умолчанию (это делает clamp в
// .chordsheet), а точка отсчёта для первого нажатия A− / A+: пока человек
// размер не трогал, переменной нет, и шагать не от чего. Число держится равным
// потолку того clamp — иначе первое нажатие давало бы скачок вместо шага.
const FONT_MIN = 0.8;
const FONT_MAX = 1.7;
const FONT_DEFAULT = 1.08;
const FONT_STEP = 0.1;

export function SongViewer({
  record,
  editHref,
  songId,
  coverUrl,
  note,
  createdAt,
  instrument,
  verified = false,
  canVerify = false,
  chordDefs,
  engagement,
  annotations = [],
  canAnnotate = false,
  shareUrl,
  shareTitle,
}: {
  record: SongRecordLike;
  editHref?: string;
  songId?: string;
  coverUrl?: string | null;
  note?: string | null;
  createdAt?: Date;
  /** Инструмент разбора — от него зависят все аппликатуры на странице. */
  instrument?: InstrumentId | null;
  /** Разбор подтверждён модератором. */
  verified?: boolean;
  /** Показывать ли кнопку подтверждения (только администратору). */
  canVerify?: boolean;
  chordDefs?: Record<string, ChordShape>;
  engagement?: SongEngagement;
  annotations?: AnnotationView[];
  canAnnotate?: boolean;
  /** Абсолютная ссылка для кнопки «Поделиться». */
  shareUrl?: string;
  shareTitle?: string;
}) {
  const createdLabel = createdAt?.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const base = useMemo(() => songFromRecord(record), [record]);
  const inst = getInstrument(instrument);

  // Подпись под шапкой: только то, чего страница не говорит в других местах.
  const metaBits = [
    base.meta.tempo ? `${base.meta.tempo} bpm` : null,
    createdLabel ? `добавлено ${createdLabel}` : null,
  ].filter(Boolean);

  const [transpose, setTranspose] = useState(0);
  const [showChords, setShowChords] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const [speed, setSpeed] = useState(3);
  const [wakeOn, setWakeOn] = useState(false);
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const [fontSize, setFontSize] = useState<number | null>(null);
  // Закреплённая панель аккордов остаётся на виду при прокрутке.
  const [pinChords, setPinChords] = useState(false);

  const clampFont = (v: number) => Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(v * 100) / 100));

  // ── Настройки читалки: восстановление и сохранение ────────────────────────
  // Читаем после монтирования, а не при инициализации состояния: на сервере
  // localStorage нет, и разошедшаяся разметка ломала бы гидратацию.
  //
  // Пишем — прямо в обработчиках (см. change*), а НЕ отдельными эффектами на
  // изменение состояния: такой эффект срабатывает и на первом рендере, когда
  // восстановленное значение ещё не применилось, и успевает затереть хранилище
  // значением по умолчанию. Настройки меняются только действием пользователя,
  // поэтому сохранять их в месте изменения и проще, и надёжнее.
  useEffect(() => {
    const font = readNumberPref(viewerKeys.fontSize, FONT_MIN, FONT_MAX);
    if (font !== null) setFontSize(font);

    const sp = readIntPref(viewerKeys.speed, 1, 8);
    if (sp !== null) setSpeed(sp);

    const chords = readBoolPref(viewerKeys.showChords);
    if (chords !== null) setShowChords(chords);

    const pinned = readBoolPref(viewerKeys.pinChords);
    if (pinned !== null) setPinChords(pinned);

    // Замок экрана восстанавливаем молча: браузер разрешает взять его без
    // нажатия, лишь бы вкладка была видна, а если откажет — эффект ниже сам
    // повторит попытку, когда на неё вернутся. Единственное, чем можно
    // ошибиться, — оставить кнопку «вкл» при неудаче; это честнее, чем гасить
    // экран человеку, который просил обратного.
    const wake = readBoolPref(viewerKeys.wakeLock);
    if (wake !== null) setWakeOn(wake);

    if (songId) {
      const t = readIntPref(viewerKeys.transpose(songId), -11, 11);
      if (t !== null) setTranspose(t);
    }
  }, [songId]);

  /** Транспонирование: у каждой песни своё, ноль — это «как записано». */
  const changeTranspose = (next: number) => {
    const value = Math.max(-11, Math.min(11, next));
    setTranspose(value);
    if (songId) writePref(viewerKeys.transpose(songId), value === 0 ? null : value);
  };

  const changeFontSize = (next: number | null) => {
    setFontSize(next);
    writePref(viewerKeys.fontSize, next);
  };

  const changeSpeed = (next: number) => {
    setSpeed(next);
    writePref(viewerKeys.speed, next);
  };

  const changeShowChords = (next: boolean) => {
    setShowChords(next);
    writePref(viewerKeys.showChords, next);
  };

  const changePinChords = (next: boolean) => {
    setPinChords(next);
    writePref(viewerKeys.pinChords, next);
  };

  const changeWakeOn = (next: boolean) => {
    setWakeOn(next);
    writePref(viewerKeys.wakeLock, next);
  };

  // ── Лайк и избранное без перезагрузки страницы ────────────────────────────
  // Экшены больше не ревалидируют маршрут (это и сбрасывало транспонирование,
  // шрифт и прокрутку), поэтому актуальное состояние держим здесь: сначала
  // показываем оптимистично, затем заменяем ответом сервера.
  const [eng, setEng] = useState(engagement);
  useEffect(() => setEng(engagement), [engagement]);

  const [optimisticEng, applyOptimistic] = useOptimistic(
    eng,
    (state: SongEngagement | undefined, action: 'like' | 'favorite') => {
      if (!state) return state;
      if (action === 'like') {
        return {
          ...state,
          liked: !state.liked,
          likeCount: Math.max(0, state.likeCount + (state.liked ? -1 : 1)),
        };
      }
      return { ...state, favorited: !state.favorited };
    },
  );
  const [, startEngagement] = useTransition();

  const onToggleLike = () => {
    if (!songId) return;
    startEngagement(async () => {
      applyOptimistic('like');
      const next = await toggleLikeAction(songId);
      setEng((cur) => (cur ? { ...cur, ...next } : cur));
    });
  };

  const onToggleFavorite = () => {
    if (!songId) return;
    startEngagement(async () => {
      applyOptimistic('favorite');
      const next = await toggleFavoriteAction(songId);
      setEng((cur) => (cur ? { ...cur, ...next } : cur));
    });
  };

  // ── Подтверждение модератора ──────────────────────────────────────────────
  const [isVerified, setIsVerified] = useState(verified);
  useEffect(() => setIsVerified(verified), [verified]);
  const [optimisticVerified, applyVerified] = useOptimistic(
    isVerified,
    (_state: boolean, next: boolean) => next,
  );
  const [, startVerify] = useTransition();

  const onToggleVerified = () => {
    if (!songId) return;
    startVerify(async () => {
      applyVerified(!isVerified);
      const next = await toggleVerifiedAction(songId);
      setIsVerified(next.verified);
    });
  };

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

  const shapeSong = useMemo(() => transposeSong(base, transpose), [base, transpose]);
  const realKey = base.meta.key ? transposeKey(base.meta.key, transpose) : null;
  const usedChords = useMemo(() => chordsFromSong(shapeSong), [shapeSong]);

  const offsetLabel = transpose > 0 ? `+${transpose}` : transpose < 0 ? `${transpose}` : '±0';

  // Панель аккордов. Когда закреплена — рендерится ВНУТРИ липкого блока с
  // тулбаром, а не отдельно: так она всегда встаёт ровно под ним, без подбора
  // смещения (а тулбар на узком экране может переноситься и менять высоту).
  const chordBar = (
    <div className={pinChords ? 'chord-bar chord-bar--pinned print-hide' : 'chord-bar print-hide'}>
      {/* Закреплённые аккорды не переносятся на вторую строку, а едут
          горизонтально: иначе на телефоне они съели бы пол-экрана. */}
      <div className="chord-bar-strip">
        {usedChords.map((c) => (
          <ChordCard
            key={c}
            name={c}
            instrument={inst}
            customDefs={chordDefs}
            size={pinChords ? 62 : 96}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={() => changePinChords(!pinChords)}
        className={pinChords ? 'chord-pin chord-pin--on' : 'chord-pin'}
        aria-pressed={pinChords}
        title={pinChords ? 'Открепить аккорды' : 'Закрепить аккорды сверху'}
        aria-label={pinChords ? 'Открепить аккорды' : 'Закрепить аккорды сверху'}
      >
        <PinIcon />
      </button>
    </div>
  );

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
      // Уже держим — второй замок не берём: браузер отдаст ещё один объект, а
      // ссылку мы храним одну, и прежний остался бы висеть до закрытия вкладки.
      if (sentinelRef.current && !sentinelRef.current.released) return;
      try {
        const sentinel = await navigator.wakeLock.request('screen');
        // Пока ждали ответ, могли уйти со страницы или выключить настройку.
        // Тогда замок надо не запоминать, а сразу отпускать — иначе экран
        // остался бы гореть после ухода.
        if (cancelled) {
          sentinel.release().catch(() => {});
          return;
        }
        sentinelRef.current = sentinel;
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
    // song-layout: на широком экране панель аппликатур уезжает отсюда в пустое
    // поле справа отдельной липкой колонкой (см. globals.css). Разметка при
    // этом не меняется — вся раскладка держится на CSS.
    <div className="song-layout">
      <header className="mb-6">
        {/* Верхний ряд: обложка слева, крупный заголовок рядом (заполняет место
            справа от обложки), кнопка редактирования — в правом верхнем углу. */}
        <div className="flex gap-4">
          {coverUrl ? (
            <div className="cover-fill">
              {/* Подпись описывает картинку как картинку («обложка такой-то
                  песни»), а не повторяет заголовок: она есть в карте сайта и
                  участвует в поиске по картинкам, где текста рядом нет.
                  Миниатюры в списках так НЕ подписаны (alt="") — там название
                  стоит вплотную, и подпись читалась бы дважды. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverUrl}
                alt={`Обложка: ${base.meta.title ?? 'без названия'}${base.meta.artist ? ` — ${base.meta.artist}` : ''}`}
                className="cover-fill-img"
                decoding="async"
              />
            </div>
          ) : null}
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="min-w-0 flex-1 self-center">
              {/* Галочка идёт прямо в потоке текста, а не отдельной колонкой
                  flex: так она встаёт в конец названия (за последним словом,
                  даже когда оно перенеслось), как и в каталоге. Неразрывный
                  пробел не даёт ей оторваться от слова. */}
              <h1 className="display text-4xl font-medium sm:text-5xl">
                {base.meta.title ?? 'Без названия'}
                {optimisticVerified ? (
                  <>
                    {' '}
                    <VerifiedBadge size={30} />
                  </>
                ) : null}
              </h1>
              {base.meta.artist ? (
                <p className="mt-1.5 text-lg text-muted">
                  {/* Клик по исполнителю — все его разборы */}
                  <Link
                    href={`/artist/${encodeURIComponent(base.meta.artist)}`}
                    className="hover:text-fg hover:underline"
                  >
                    {base.meta.artist}
                  </Link>
                </p>
              ) : null}
            </div>
            {editHref ? (
              <Link
                href={editHref}
                className="btn btn-outline h-11 w-11 shrink-0 px-0 text-sm print-hide sm:w-auto sm:px-4"
                title="Редактировать"
                aria-label="Редактировать"
              >
                <PencilIcon />
                <span className="hidden sm:inline">Редактировать</span>
              </Link>
            ) : null}
          </div>
        </div>

        {/* Строка была длиннее: «Аккорды для гитары · тональность · bpm · дата».
            Инструмент и тональность отсюда ушли — их страница уже говорит в
            других местах (первой крошкой над обложкой и крупно в панели
            управления), и вторым разом они только шумели. Остались темп и дата:
            их больше нигде нет.

            Соединение через join, а не разделителем в разметке, как было:
            частей теперь две, и городить ради них Fragment с отдельным
            <span> под точку незачем. */}
        {metaBits.length > 0 ? (
          <p className="mt-3 text-muted">{metaBits.join(' · ')}</p>
        ) : null}

        {/* «Поделиться» доступна всем, лайк/избранное — только со входом. */}
        <div className="print-hide mt-3 flex flex-wrap items-center gap-2">
          {optimisticEng && songId ? (
            <>
              <button
                type="button"
                onClick={onToggleLike}
                className={`btn h-9 gap-1.5 px-3 text-sm ${optimisticEng.liked ? 'btn-primary' : 'btn-outline'}`}
                aria-pressed={optimisticEng.liked}
                title={optimisticEng.liked ? 'Убрать лайк' : 'Лайк'}
              >
                <HeartIcon filled={optimisticEng.liked} />
                {optimisticEng.likeCount}
              </button>
              <button
                type="button"
                onClick={onToggleFavorite}
                className={`btn h-9 gap-1.5 px-3 text-sm ${optimisticEng.favorited ? 'btn-primary' : 'btn-outline'}`}
                aria-pressed={optimisticEng.favorited}
              >
                <BookmarkIcon filled={optimisticEng.favorited} />
                <span className="hidden sm:inline">
                  {optimisticEng.favorited ? 'В избранном' : 'В избранное'}
                </span>
              </button>
            </>
          ) : null}

          {shareUrl ? <ShareButton url={shareUrl} title={shareTitle ?? ''} /> : null}

          {optimisticEng ? (
            <span className="ml-1 flex items-center gap-1.5 text-sm text-muted" title="Просмотры">
              <ViewsIcon />
              {optimisticEng.viewCount}
            </span>
          ) : null}

          {/*
            Подтверждение разбора — только у модератора, и стоит последним,
            приглушённым и без заливки.

            Раньше подтверждённый разбор рисовал здесь кнопку, залитую акцентом:
            она была самым громким элементом страницы, хотя читателю не говорит
            ничего (о подтверждении сообщает галочка у заголовка), а модератору
            на уже подтверждённом разборе делать нечего. Крупная подпись нужна
            ровно в одном состоянии — когда есть что нажать.
          */}
          {canVerify && songId ? (
            <button
              type="button"
              onClick={onToggleVerified}
              className={`btn h-9 gap-1.5 text-sm ${optimisticVerified ? 'btn-ghost w-9 px-0' : 'btn-outline px-3'}`}
              aria-pressed={optimisticVerified}
              aria-label={optimisticVerified ? 'Снять подтверждение' : 'Подтвердить: аккорды верны'}
              title={
                optimisticVerified
                  ? `Снять подтверждение · ${VERIFIED_TITLE}`
                  : 'Подтвердить: аккорды верны'
              }
            >
              <CheckIcon />
              {optimisticVerified ? null : <span className="hidden sm:inline">Подтвердить</span>}
            </button>
          ) : null}
        </div>
      </header>

      {/* Панель управления */}
      <div className="print-hide sticky top-[3.75rem] z-30 mb-8">
        <div className="toolbar">
          <button
            type="button"
            onClick={() => changeTranspose(transpose - 1)}
            className="icon-btn"
            aria-label="Понизить на полутон"
          >
            −
          </button>
          {/* Крупно — текущая тональность, мелко — на сколько сдвинули. Если
              тональность у разбора не указана, сдвиг занимает крупную строку и
              мелкая НЕ рисуется: иначе «±0» стояло дважды подряд, и читалось
              это как два разных числа, которые почему-то совпали. */}
          <div className="key-readout">
            <b>{realKey ?? offsetLabel}</b>
            {realKey ? <span>{offsetLabel}</span> : null}
          </div>
          <button
            type="button"
            onClick={() => changeTranspose(transpose + 1)}
            className="icon-btn"
            aria-label="Повысить на полутон"
          >
            +
          </button>

          <button
            type="button"
            onClick={() => changeShowChords(!showChords)}
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
          <div className="toolbar-panel mt-2 flex flex-col gap-5 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted">Размер текста</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => changeFontSize(clampFont((fontSize ?? FONT_DEFAULT) - FONT_STEP))}
                  className="icon-btn h-9 w-9 text-sm"
                  aria-label="Меньше"
                >
                  A−
                </button>
                {fontSize !== null ? (
                  <button
                    type="button"
                    onClick={() => changeFontSize(null)}
                    className="btn btn-ghost h-9 px-2 text-xs"
                  >
                    сброс
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => changeFontSize(clampFont((fontSize ?? FONT_DEFAULT) + FONT_STEP))}
                  className="icon-btn h-9 w-9 text-lg"
                  aria-label="Больше"
                >
                  A+
                </button>
              </div>
            </div>

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
                onChange={(e) => changeSpeed(Number(e.target.value))}
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              {wakeSupported ? (
                <button
                  type="button"
                  onClick={() => changeWakeOn(!wakeOn)}
                  className={wakeOn ? 'btn btn-primary h-9 px-3 text-sm' : 'btn btn-outline h-9 px-3 text-sm'}
                  aria-pressed={wakeOn}
                >
                  {wakeOn ? 'Экран не гаснет: вкл' : 'Не гасить экран'}
                </button>
              ) : null}

              <button type="button" onClick={() => window.print()} className="btn btn-outline h-9 px-3 text-sm">
                Печать / PDF
              </button>


              {transpose !== 0 ? (
                <button
                  type="button"
                  onClick={() => changeTranspose(0)}
                  className="btn btn-ghost h-9 px-2 text-sm"
                >
                  Сбросить
                </button>
              ) : null}
            </div>

            {/* Подсказка про заметки жила отдельной строкой над текстом песни и
                висела там постоянно — притом что нужна она один раз и только
                владельцу разбора. Здесь она на виду у того, кто открыл
                настройки, и не мешает всем остальным. */}
            {canAnnotate ? (
              <p className="border-t border-line pt-4 text-sm text-faint">
                Нажмите на строку песни, чтобы добавить к ней заметку.
              </p>
            ) : null}
          </div>
        ) : null}

        {usedChords.length > 0 && pinChords ? chordBar : null}
      </div>

      {/* Открепленная панель стоит на своём месте в потоке страницы;
          закреплённая отрисована выше, внутри липкого блока с тулбаром. */}
      {usedChords.length > 0 && !pinChords ? chordBar : null}

      {note ? (
        <div className="song-note">
          <span className="song-note-label">От автора</span>
          <p className="song-note-text">{note}</p>
        </div>
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
          renderChord={(c) => (
            <InlineChord name={c} instrument={inst.id} customDefs={chordDefs} />
          )}
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
                        {notes.map((n) => {
                          const typeLabel = noteTypeLabel(n.type);
                          return (
                          <div key={n.id} className="cs-note">
                            {typeLabel ? (
                              <span className="cs-note-type">{typeLabel}</span>
                            ) : null}
                            <span className="cs-note-text">{n.text}</span>
                            {canAnnotate && songId ? (
                              <form action={deleteAnnotationAction} className="print-hide ml-auto">
                                <input type="hidden" name="id" value={n.id} />
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
                          );
                        })}
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
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
function ViewsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
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
function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {/* Канцелярская кнопка (📌): шляпка, ножка и остриё вниз — «воткнули» */}
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.89A2 2 0 0 1 15 10.76V6h1a2 2 0 1 0 0-4H8a2 2 0 1 0 0 4h1v4.76a2 2 0 0 1-1.11 1.8l-1.78.89A2 2 0 0 0 5 15.24Z" />
      <path d="M12 17v5" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m20 6-11 11-5-5" />
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
