import { describe, expect, it } from 'vitest';
import { titleFit } from './songTitle';

describe('titleFit', () => {
  it('однословное название: строка и слово — одно и то же', () => {
    const fit = titleFit('Пьяные');
    expect(fit.words).toBe(1);
    expect(fit.longestWord).toBe(fit.oneLine);
  });

  it('слова считаются, лишние пробелы не в счёт', () => {
    expect(titleFit('  ванна   красный пол ').words).toBe(3);
  });

  it('в строку целиком шире, чем самое длинное слово', () => {
    const fit = titleFit('давай увидимся');
    expect(fit.oneLine).toBeGreaterThan(fit.longestWord);
  });

  it('самое длинное слово задаёт потолок, а не последнее', () => {
    const fit = titleFit('я увидимся');
    // «увидимся» длиннее «я» — на него и смотрим.
    expect(fit.longestWord).toBeGreaterThan(titleFit('я').longestWord);
  });

  it('галочка подтверждения добавляется к последнему слову', () => {
    const plain = titleFit('Пьяные');
    const verified = titleFit('Пьяные', true);
    expect(verified.longestWord).toBeGreaterThan(plain.longestWord);
    expect(verified.oneLine).toBeGreaterThan(plain.oneLine);
  });

  it('широкие буквы шире узких', () => {
    expect(titleFit('шшш').oneLine).toBeGreaterThan(titleFit('ттт').oneLine);
  });

  it('пустое название не роняет расчёт', () => {
    const fit = titleFit('   ');
    expect(fit.words).toBe(0);
    expect(fit.oneLine).toBeGreaterThan(0);
    expect(fit.longestWord).toBeGreaterThan(0);
  });

  it('ширины совпадают с замером Spectral: «увидимся» — около 4.4 кегля', () => {
    // Опора для правок таблицы: 30px × 4.4 ≈ 131px, столько слово занимает в
    // браузере. Разъедется таблица — разъедется и кегль.
    expect(titleFit('увидимся').oneLine).toBeCloseTo(4.44, 1);
  });
});
