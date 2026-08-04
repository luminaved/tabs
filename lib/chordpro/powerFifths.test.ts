import { describe, expect, it } from 'vitest';
import { normalizePowerFifths, powerFifthRenames } from './powerFifths';

describe('powerFifthRenames', () => {
  it('находит старую запись без повторов, в порядке появления', () => {
    const body = '[5В]сло[3Н]во\n[5В]ещё[7Н]раз';
    expect(powerFifthRenames(body)).toEqual([
      { from: '5В', to: 'A5' },
      { from: '3Н', to: 'C5' },
      { from: '7Н', to: 'E5' },
    ]);
  });

  it('обычные аккорды не трогает', () => {
    expect(powerFifthRenames('[Am]текст[C]ещё[F#m]')).toEqual([]);
    // Уже переведённые — тоже: предлагать нечего
    expect(powerFifthRenames('[A5]текст[C5]')).toEqual([]);
  });

  it('написание нот берётся из тональности песни', () => {
    expect(powerFifthRenames('[1Н]', 'Am')).toEqual([{ from: '1Н', to: 'A#5' }]);
    // Бемольная тональность — бемольное написание
    expect(powerFifthRenames('[1Н]', 'Dm')).toEqual([{ from: '1Н', to: 'Bb5' }]);
  });

  it('на укулеле подсказки нет — там таких квинт не играют', () => {
    expect(powerFifthRenames('[5В]текст', null, 'ukulele')).toEqual([]);
  });
});

describe('normalizePowerFifths', () => {
  it('переписывает только токены аккордов', () => {
    expect(normalizePowerFifths('[5В]сло[3Н]во')).toBe('[A5]сло[C5]во');
  });

  it('такой же текст в словах песни остаётся нетронутым', () => {
    // «5В» в тексте — это просто буквы, а не аккорд
    expect(normalizePowerFifths('[5В]играем 5В на шестой')).toBe('[A5]играем 5В на шестой');
  });

  it('пробелы внутри скобок не мешают', () => {
    expect(normalizePowerFifths('[ 5В ]слово')).toBe('[A5]слово');
  });

  it('директивы и серый текст не задеты', () => {
    const body = '{start_of_chorus}\n[5В]припев\n%проигрыш%\n{end_of_chorus}';
    expect(normalizePowerFifths(body)).toBe(
      '{start_of_chorus}\n[A5]припев\n%проигрыш%\n{end_of_chorus}',
    );
  });

  it('на укулеле текст не меняется', () => {
    expect(normalizePowerFifths('[5В]текст', null, 'ukulele')).toBe('[5В]текст');
  });

  it('после замены предлагать больше нечего', () => {
    const once = normalizePowerFifths('[5В]a[7Н]b', 'Am');
    expect(powerFifthRenames(once, 'Am')).toEqual([]);
  });
});
