'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/session';
import { createSong, deleteSong, updateSong, type SongInput, type SongVisibility } from '@/lib/songs';

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

  const coverUrl = String(formData.get('coverUrl') ?? '');

  return {
    title,
    artist: String(formData.get('artist') ?? ''),
    key: String(formData.get('key') ?? ''),
    tempo: Number.isFinite(tempoNum) && tempoNum > 0 ? tempoNum : null,
    body: String(formData.get('body') ?? ''),
    note: String(formData.get('note') ?? ''),
    coverUrl: coverUrl.startsWith('data:image/') ? coverUrl : null,
    chordDefs: String(formData.get('chordDefs') ?? '') || null,
    visibility,
  };
}

export async function createSongAction(_prev: SongFormState, formData: FormData): Promise<SongFormState> {
  const user = await requireUser();
  const parsed = parseForm(formData);
  if ('error' in parsed) return parsed;

  const song = await createSong(user.id, parsed);
  revalidatePath('/songs');
  redirect(`/songs/${song.id}`);
}

export async function updateSongAction(_prev: SongFormState, formData: FormData): Promise<SongFormState> {
  const user = await requireUser();
  const id = String(formData.get('id') ?? '');
  const parsed = parseForm(formData);
  if ('error' in parsed) return parsed;

  const updated = await updateSong(id, user.id, parsed);
  if (!updated) return { error: 'Песня не найдена или нет доступа' };

  revalidatePath('/songs');
  revalidatePath(`/songs/${id}`);
  redirect(`/songs/${id}`);
}

export async function deleteSongAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get('id') ?? '');
  await deleteSong(id, user.id);
  revalidatePath('/songs');
  redirect('/songs');
}
