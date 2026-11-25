import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  readBoolPref,
  readIntPref,
  readNumberPref,
  viewerKeys,
  writePref,
} from './viewerPrefs';

class MemoryStorage {
  map = new Map<string, string>();
  full = false;
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (this.full) throw new Error('QuotaExceededError');
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal('window', { localStorage: storage });
});
afterEach(() => vi.unstubAllGlobals());

describe('viewerKeys', () => {
  it('транспонирование — свой ключ у каждой песни', () => {
    expect(viewerKeys.transpose('a')).not.toBe(viewerKeys.transpose('b'));
  });

  it('шрифт, скорость и аккорды — общие ключи без id песни', () => {
    for (const k of [viewerKeys.fontSize, viewerKeys.speed, viewerKeys.showChords]) {
      expect(k.startsWith('tabs.viewer.v1.')).toBe(true);
      expect(k).not.toMatch(/\.[a-z0-9]{20,}$/);
    }
  });
});

describe('readNumberPref / readIntPref', () => {
  it('читает записанное', () => {
    writePref('k', 1.3);
    expect(readNumberPref('k', 0, 2)).toBe(1.3);
  });

  it('значения вне границ отбрасываются', () => {
    writePref('k', 99);
    expect(readNumberPref('k', 0, 2)).toBeNull();
    writePref('k', -50);
    expect(readIntPref('k', -11, 11)).toBeNull();
  });

  it('границы включительно', () => {
    writePref('k', -11);
    expect(readIntPref('k', -11, 11)).toBe(-11);
    writePref('k', 11);
    expect(readIntPref('k', -11, 11)).toBe(11);
  });

  it('мусор и пустое — null', () => {
    writePref('k', 'ерунда');
    expect(readNumberPref('k', 0, 2)).toBeNull();
    writePref('k', '');
    expect(readNumberPref('k', 0, 2)).toBeNull();
    expect(readNumberPref('нет-такого', 0, 2)).toBeNull();
  });

  it('ноль — валидное значение, а не «пусто»', () => {
    writePref('k', 0);
    expect(readIntPref('k', -11, 11)).toBe(0);
  });

  it('readIntPref обрезает дробную часть', () => {
    writePref('k', 3.7);
    expect(readIntPref('k', 0, 8)).toBe(3);
  });
});

describe('readBoolPref', () => {
  it('true/false читаются, остальное — null', () => {
    writePref('k', true);
    expect(readBoolPref('k')).toBe(true);
    writePref('k', false);
    expect(readBoolPref('k')).toBe(false);
    writePref('k', 'ага');
    expect(readBoolPref('k')).toBeNull();
  });
});

describe('writePref', () => {
  it('null удаляет ключ', () => {
    writePref('k', 5);
    writePref('k', null);
    expect(readNumberPref('k', 0, 10)).toBeNull();
  });

  it('переполненная квота не роняет запись', () => {
    storage.full = true;
    expect(() => writePref('k', 1)).not.toThrow();
  });
});
