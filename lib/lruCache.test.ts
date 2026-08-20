import { describe, expect, it } from 'vitest';
import { createLruCache } from './lruCache';

describe('createLruCache', () => {
  it('отдаёт положенное и не выдумывает отсутствующее', () => {
    const cache = createLruCache<number>(2);
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeUndefined();
  });

  it('держит ровно limit записей', () => {
    const cache = createLruCache<number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
  });

  /**
   * То, ради чего кэш и заведён отдельно от прежней ручной вытеснялки: она
   * выбрасывала первую ВСТАВЛЕННУЮ запись независимо от обращений, то есть под
   * нагрузкой первой вылетала самая ходовая картинка.
   */
  it('вытесняет давно не спрошенное, а не давно положенное', () => {
    const cache = createLruCache<number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a'); // «a» снова нужна
    cache.set('c', 3);

    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeUndefined();
  });

  it('повторная запись по тому же ключу не съедает место', () => {
    const cache = createLruCache<number>(2);
    cache.set('a', 1);
    cache.set('a', 2);
    cache.set('b', 3);
    expect(cache.get('a')).toBe(2);
    expect(cache.get('b')).toBe(3);
  });
});
