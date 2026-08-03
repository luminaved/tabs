'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/session';
import { createSong, deleteSong, updateSong, type SongInput, type SongVisibility } from '@/lib/songs';
import { parseInstrumentId } from '@/lib/chords/instruments';
import { parseCoverField } from '@/lib/imageInput';
import { songPath } from '@/lib/slug';

export interface SongFormState {
  error?: string;
}

const VISIBILITIES: SongVisibility[] = ['private', 'unlisted', 'public'];

function parseForm(formData: FormData): SongInput | { error: string } {
  const title = String(formData.get('title') ?? '').trim();
  if (!title) return { error: 'Введите название' };

  const v = String(formData.get('visibility') ?? 'private');
  const visibility = (VISIBILITIES as string[]).includes(v) ? (v as SongVisibility) : 'private';

  const tempoRaw = String(formData.get('tempo') ?? '').trim();
  const tempoNum = tempoRaw ? Number(tempoRaw) : NaN;

  // Обложка: сентинел «не трогали», пустое поле «убрать», иначе новая картинка
  // (разбор и потолок размера — в parseCoverField). Проверка обязана быть на
  // сервере: форма уходит в серверный экшен, и клиентское сжатие обойти ничего
  // не стоит. Не прошедшую картинку не выбрасываем молча — иначе сохранение
  // стёрло бы её без единого слова.
  const cover = parseCoverField(String(formData.get('coverUrl') ?? ''));
  if (cover.kind === 'invalid') {
    return { error: 'Обложка слишком большая или в неподдерживаемом формате' };
  }
  const coverUrl =
    cover.kind === 'keep' ? undefined : cover.kind === 'remove' ? null : cover.dataUrl;

  return {
    title,
    artist: String(formData.get('artist') ?? ''),
    key: String(formData.get('key') ?? ''),
    tempo: Number.isFinite(tempoNum) && tempoNum > 0 ? tempoNum : null,
    body: String(formData.get('body') ?? ''),
    note: String(formData.get('note') ?? ''),
    coverUrl,
    chordDefs: String(formData.get('chordDefs') ?? '') || null,
    visibility,
    instrument: parseInstrumentId(String(formData.get('instrument') ?? '')),
  };
}

export async function createSongAction(_prev: SongFormState, formData: FormData): Promise<SongFormState> {
  const user = await requireUser();
  const parsed = parseForm(formData);
  if ('error' in parsed) return parsed;

  const song = await createSong(user.id, parsed);
  revalidatePath('/songs');
  // Сразу на канонический адрес с подписью — иначе первый же переход после
  // сохранения ловил бы 308 из layout'а просмотра.
  redirect(songPath(song));
}

export async function updateSongAction(_prev: SongFormState, formData: FormData): Promise<SongFormState> {
  const user = await requireUser();
  const id = String(formData.get('id') ?? '');
  const parsed = parseForm(formData);
  if ('error' in parsed) return parsed;

  const updated = await updateSong(id, user.id, parsed);
  if (!updated) return { error: 'Песня не найдена или нет доступа' };

  // Сброс по шаблону маршрута: подпись в адресе зависит от названия, поэтому
  // после правки собранный адрес мог измениться, и перечислять оба варианта
  // руками — лишний способ ошибиться.
  const path = songPath(updated);
  revalidatePath('/songs');
  revalidatePath('/songs/[id]', 'page');
  redirect(path);
}

/**
 * Удаление разбора. Кнопка есть только у владельца на своей странице, поэтому
 * отказ `deleteSong` — это не сценарий интерфейса, а либо гонка (разбор уже
 * удалён), либо подмена id. Раньше результат игнорировался и экшен в любом
 * случае уводил на /songs, то есть неудавшееся удаление выглядело удавшимся.
 */
export async function deleteSongAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get('id') ?? '');

  const deleted = await deleteSong(id, user.id);
  if (!deleted) throw new Error('Песня не найдена или нет доступа');

  revalidatePath('/songs');
  redirect('/songs');
}
