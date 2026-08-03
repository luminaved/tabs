'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { requireAdmin } from '@/lib/admin';
import { currentVisitorKey, clientIpFrom } from '@/lib/visitor';
import { hit } from '@/lib/rateLimit';
import { parseInstrumentId } from '@/lib/chords/instruments';
import {
  ARTIST_MAX,
  TITLE_MAX,
  createOrVote,
  deleteRequest,
  voteForRequest,
  type RequesterRef,
} from '@/lib/songRequests';

export interface RequestFormState {
  error?: string;
  /** Что показать после успеха — исходы у формы разные. */
  done?: 'created' | 'voted' | 'known';
}

/**
 * Заявок с одного адреса в час. Форма открыта гостям, то есть это единственная
 * на сайте запись в БД без входа, — потолок здесь не перестраховка. Пятёрки
 * хватает любому живому человеку: столько песен подряд не вспоминают.
 */
const REQUEST_LIMIT = 5;
const REQUEST_WINDOW_MS = 60 * 60 * 1000;

/** Кто просит: аккаунт, иначе суточный отпечаток. У бота — ни того, ни другого. */
async function currentRequester(): Promise<RequesterRef | null> {
  const session = await auth();
  if (session?.user?.id) return { userId: session.user.id };
  const key = await currentVisitorKey();
  return key ? { visitorId: key } : null;
}

export async function requestSongAction(
  _prev: RequestFormState,
  formData: FormData,
): Promise<RequestFormState> {
  const title = String(formData.get('title') ?? '').trim();
  const artist = String(formData.get('artist') ?? '').trim() || null;
  const instrument = parseInstrumentId(String(formData.get('instrument') ?? ''));

  if (!title) return { error: 'Введите название песни' };
  if (title.length > TITLE_MAX) return { error: `Название длиннее ${TITLE_MAX} символов` };
  if (artist && artist.length > ARTIST_MAX) {
    return { error: `Имя исполнителя длиннее ${ARTIST_MAX} символов` };
  }

  // Лимит считаем ПОСЛЕ проверки полей: опечатка в форме — не попытка.
  const h = await headers();
  const ip = clientIpFrom((n) => h.get(n)) || 'no-ip';
  const limit = await hit(`request:${ip}`, REQUEST_LIMIT, REQUEST_WINDOW_MS);
  if (!limit.ok) {
    const minutes = Math.ceil(limit.retryAfter / 60);
    return { error: `Слишком много заявок. Попробуйте через ${minutes} мин.` };
  }

  const result = await createOrVote({ title, artist, instrument }, await currentRequester());

  revalidatePath('/requests');
  // Три разных исхода, и человеку они значат разное: завёл новую заявку,
  // поддержал чужую, либо уже поддерживал её раньше.
  return { done: result.created ? 'created' : result.voted ? 'voted' : 'known' };
}

/**
 * Голос за существующую заявку.
 *
 * Отдельный экшен от формы: голосуют кнопкой из списка, где название и
 * исполнитель уже известны, — переспрашивать их незачем.
 */
export async function voteRequestAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  const h = await headers();
  const ip = clientIpFrom((n) => h.get(n)) || 'no-ip';
  // Голос дешевле заявки, но и он пишет в базу — потолок тот же по порядку.
  const limit = await hit(`request-vote:${ip}`, REQUEST_LIMIT * 4, REQUEST_WINDOW_MS);
  if (!limit.ok) return;

  const requester = await currentRequester();
  if (!requester) return;

  // Именно `voteForRequest`, а НЕ `createOrVote`: тот при отсутствии заявки
  // создаёт новую, и удаление спама админом отменялось бы первым же кликом с
  // чужой открытой вкладки. Голос должен быть только голосом.
  await voteForRequest(id, requester);
  revalidatePath('/requests');
}

/** Удаление заявки. Только администратору: список публичный. */
export async function deleteRequestAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  await deleteRequest(id);
  revalidatePath('/requests');
}
