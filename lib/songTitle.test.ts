import { describe, expect, it } from 'vitest';
import { titleFit } from './songTitle';

describe('titleFit', () => {
  it('однословное название: делить нечего, обе ширины совпадают', () => {
    const fit = titleFit('Пьяные');
    expect(fit.twoLines).toBe(fit.oneLine);
  });

  it('лишние пробелы не считаются словами', () => {
    expect(titleFit('  ванна   красный пол ').oneLine).toBe(titleFit('ванна красный пол').oneLine);
  });

  it('в две строки название занимает меньше ширины, чем в одну', () => {
    const fit = titleFit('давай увидимся');
    expect(fit.twoLines).toBeLessThan(fit.oneLine);
  });

  it('две строки ломаются жадно, как в браузере', () => {
    // «я схавал опиат» браузер сломает как «я схавал» / «опиат»: первая строка
    // набирается до отказа. Значит нужная ширина — это «я схавал», а не половина
    // названия и не самое длинное слово.
    const fit = titleFit('я схавал опиат');
    const greedyFirstLine = titleFit('я схавал').oneLine;
    expect(fit.twoLines).toBeCloseTo(greedyFirstLine, 2);
  });

  it('самое длинное слово — нижняя граница: уже него не разложить', () => {
    const fit = titleFit('ванна красный пол');
    expect(fit.twoLines).toBeGreaterThanOrEqual(titleFit('красный').oneLine);
  });

  it('галочка подтверждения добавляется к последнему слову', () => {
    expect(titleFit('Пьяные', true).oneLine).toBeGreaterThan(titleFit('Пьяные').oneLine);
    expect(titleFit('давай увидимся', true).twoLines).toBeGreaterThan(
      titleFit('давай увидимся').twoLines,
    );
  });

  it('хвост под галочку — неразрывный пробел и значок в 0.72 кегля', () => {
    // Число должно совпадать с .song-title .verified-badge в globals.css:
    // значок растёт вместе с названием, и запас под него считается в долях
    // кегля. Разъедется пара — галочка начнёт переноситься на свою строку.
    //
    // Сравниваем грубо: обе ширины округлены до сотых, и разность round(a) −
    // round(b) точного значения не даёт.
    const tail = titleFit('Пьяные', true).oneLine - titleFit('Пьяные').oneLine;
    expect(tail).toBeCloseTo((0.25 + 0.72) * 1.015, 1);
  });

  it('широкие буквы шире узких', () => {
    expect(titleFit('шшш').oneLine).toBeGreaterThan(titleFit('ттт').oneLine);
  });

  it('пустое название не роняет расчёт', () => {
    const fit = titleFit('   ');
    expect(fit.oneLine).toBeGreaterThan(0);
    expect(fit.twoLines).toBeGreaterThan(0);
  });

  it('ширины совпадают с замером Spectral: «увидимся» — около 4.4 кегля', () => {
    // Опора для правок таблицы: 30px × 4.4 ≈ 131px, столько слово занимает в
    // браузере. Разъедется таблица — разъедется и кегль.
    expect(titleFit('увидимся').oneLine).toBeCloseTo(4.44, 1);
  });
});
