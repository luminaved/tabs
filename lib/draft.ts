/**
 * Черновик редактора в localStorage: если вкладку закрыли, браузер упал или
 * рука сорвалась на «Отмену» — набранное не пропадает.
 *
 * Обложка (data URL) в черновик НЕ попадает: она весит десятки килобайт и
 * быстро упирается в квоту хранилища, а восстанавливается загрузкой файла.
 */

import { pluralRu } from './plural';

export interface SongDraftFields {
  title: string;
  artist: string;
  key: string;
  tempo: string;
  note: string;
  body: string;
  visibility: string;
  instrument: string;
  chordDefs: string;
}

export interface SongDraft extends SongDraftFields {
  savedAt: number;
}

// Префикс НЕ переименован под RawChords намеренно: это ключ в localStorage у
// живых пользователей, и смена имени молча стёрла бы все несохранённые
// черновики. Бренд здесь не показывается никому — менять нечего ради чего.
const PREFIX = 'tabs.draft.v1.';

/** Ключ хранилища: у каждой песни свой, у новой — общий `new`. */
export function draftKey(songId?: string): string {
  return `${PREFIX}${songId ?? 'new'}`;
}

export function readDraft(key: string): SongDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const d = parsed as Partial<SongDraft>;
    if (typeof d.body !== 'string' || typeof d.savedAt !== 'number') return null;
    return {
      savedAt: d.savedAt,
      title: d.title ?? '',
      artist: d.artist ?? '',
      key: d.key ?? '',
      tempo: d.tempo ?? '',
      note: d.note ?? '',
      body: d.body,
      visibility: d.visibility ?? 'public',
      instrument: d.instrument ?? 'guitar',
      chordDefs: d.chordDefs ?? '',
    };
  } catch {
    // Битый JSON или заблокированное хранилище — черновика просто нет.
    return null;
  }
}

export function writeDraft(key: string, fields: SongDraftFields): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const draft: SongDraft = { ...fields, savedAt: Date.now() };
    window.localStorage.setItem(key, JSON.stringify(draft));
    return true;
  } catch {
    // Переполнена квота или приватный режим — молча живём без черновика.
    return false;
  }
}

export function clearDraft(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* хранилище недоступно — и не надо */
  }
}

/**
 * Отпечаток содержимого: по нему решаем, отличается ли черновик от того, что
 * уже сохранено на сервере. `chordDefs` не участвует — редактор аппликатур
 * пересобирает свой JSON под текущий набор аккордов, и он может отличаться от
 * записанного в БД, хотя пользователь ничего не менял.
 */
export function draftSignature(f: SongDraftFields): string {
  return [f.title, f.artist, f.key, f.tempo, f.note, f.visibility, f.instrument, f.body].join(' ');
}

/** «сейчас» / «5 минут назад» / «в 14:03» — для баннера восстановления. */
export function formatSavedAt(ts: number): string {
  const diffMin = Math.round((Date.now() - ts) / 60000);
  if (diffMin < 1) return 'только что';
  if (diffMin < 60) return `${diffMin} ${pluralRu(diffMin, 'минуту', 'минуты', 'минут')} назад`;
  const date = new Date(ts);
  const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const sameDay = new Date().toDateString() === date.toDateString();
  if (sameDay) return `сегодня в ${time}`;
  return `${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} в ${time}`;
}
