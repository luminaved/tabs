import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearDraft,
  draftKey,
  draftSignature,
  formatSavedAt,
  readDraft,
  writeDraft,
  type SongDraftFields,
} from './draft';

// Окружение тестов — node, поэтому localStorage подставляем сами. Заодно это
// проверяет, что модуль работает через глобальный `window`, а не через импорт.
class MemoryStorage {
  private map = new Map<string, string>();
  /** Если задан, setItem бросает — имитация переполненной квоты. */
  full = false;

  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.full) throw new Error('QuotaExceededError');
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

let storage: MemoryStorage;

const FIELDS: SongDraftFields = {
  title: 'Тёплый вечер',
  artist: 'демо',
  key: 'G',
  tempo: '92',
  note: 'играть тихо',
  body: '[G]Свет за окном',
  visibility: 'public',
  instrument: 'guitar',
  chordDefs: '{}',
};

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal('window', { localStorage: storage });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('draftKey', () => {
  it('у новой песни общий ключ, у существующей — свой', () => {
    expect(draftKey()).toBe('tabs.draft.v1.new');
    expect(draftKey('abc123')).toBe('tabs.draft.v1.abc123');
    expect(draftKey('abc123')).not.toBe(draftKey('xyz789'));
  });
});

describe('writeDraft / readDraft', () => {
  it('записанный черновик читается обратно целиком', () => {
    expect(writeDraft('k', FIELDS)).toBe(true);
    const draft = readDraft('k');
    expect(draft).toMatchObject(FIELDS);
    expect(typeof draft?.savedAt).toBe('number');
  });

  it('черновика нет — null', () => {
    expect(readDraft('пусто')).toBeNull();
  });

  it('битый JSON не роняет чтение', () => {
    storage.setItem('k', '{не json');
    expect(readDraft('k')).toBeNull();
  });

  it('запись без обязательных полей отбрасывается', () => {
    storage.setItem('k', JSON.stringify({ title: 'без текста' }));
    expect(readDraft('k')).toBeNull();
  });

  it('переполненная квота не роняет запись', () => {
    storage.full = true;
    expect(writeDraft('k', FIELDS)).toBe(false);
  });

  it('clearDraft удаляет', () => {
    writeDraft('k', FIELDS);
    clearDraft('k');
    expect(readDraft('k')).toBeNull();
  });
});

describe('draftSignature', () => {
  it('одинаковое содержимое — одинаковый отпечаток', () => {
    expect(draftSignature(FIELDS)).toBe(draftSignature({ ...FIELDS }));
  });

  it('правка текста меняет отпечаток', () => {
    expect(draftSignature({ ...FIELDS, body: '[C]другое' })).not.toBe(draftSignature(FIELDS));
  });

  it('смена инструмента меняет отпечаток', () => {
    expect(draftSignature({ ...FIELDS, instrument: 'ukulele' })).not.toBe(draftSignature(FIELDS));
  });

  it('перестановка полей не выдаёт себя за то же содержимое', () => {
    // Разделитель обязан быть настоящим, иначе «ab|c» и «a|bc» совпадут.
    const a = draftSignature({ ...FIELDS, title: 'ab', artist: 'c' });
    const b = draftSignature({ ...FIELDS, title: 'a', artist: 'bc' });
    expect(a).not.toBe(b);
  });

  it('аппликатуры в отпечаток не входят — их JSON пересобирается сам', () => {
    expect(draftSignature({ ...FIELDS, chordDefs: '{"Am":{"frets":[0,0,2,2,1,0]}}' })).toBe(
      draftSignature(FIELDS),
    );
  });
});

describe('formatSavedAt', () => {
  it('свежая запись — «только что»', () => {
    expect(formatSavedAt(Date.now())).toBe('только что');
  });

  it('минуты склоняются по-русски', () => {
    const min = (n: number) => formatSavedAt(Date.now() - n * 60_000);
    expect(min(1)).toBe('1 минуту назад');
    expect(min(3)).toBe('3 минуты назад');
    expect(min(5)).toBe('5 минут назад');
    expect(min(11)).toBe('11 минут назад');
    expect(min(21)).toBe('21 минуту назад');
    expect(min(44)).toBe('44 минуты назад');
  });

  it('больше часа назад — время, а не минуты', () => {
    expect(formatSavedAt(Date.now() - 3 * 3600_000)).toMatch(/в \d{2}:\d{2}$/);
  });
});
