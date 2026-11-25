import { describe, expect, it } from 'vitest';
import { detectKey } from './key';

/** Последовательность аккордов «как звучит»: с повторами, в порядке игры. */
const seq = (s: string) => s.split(/\s+/).filter(Boolean);

describe('detectKey', () => {
  it('классические обороты определяются однозначно', () => {
    // I–V–vi–IV в D: заканчиваем на тонике.
    expect(detectKey(seq('D A Bm G D A Bm G D'))).toBe('D');
    // I–IV–V в B.
    expect(detectKey(seq('B E F# B E F# B'))).toBe('B');
    // Весь диатонический набор Eb-мажора.
    expect(detectKey(seq('Cm Bb Ab Eb Cm Bb Ab Eb'))).toBe('Eb');
  });

  it('минор отличается от своего относительного мажора по разрешению', () => {
    // Состав гаммы у C и Am совпадает ПОЛНОСТЬЮ — различает только то, чем
    // песня кончается и какое трезвучие стоит на тонике.
    expect(detectKey(seq('Am F C G Am F C G Am'))).toBe('Am');
    expect(detectKey(seq('C F Am G C F Am G C'))).toBe('C');
  });

  it('качество тонического трезвучия учитывается', () => {
    expect(detectKey(seq('Em C G D Em C G D Em'))).toBe('Em');
    expect(detectKey(seq('G D Em C G D Em C G'))).toBe('G');
  });

  it('чужая нота в гамме отбрасывает тональность', () => {
    // C, G# и G вместе не ложатся ни в одну тональность — честнее промолчать.
    expect(detectKey(seq('C5 G#5 G5 C5 G#5 G5'))).toBeNull();
  });

  it('на одном корне тональности нет', () => {
    expect(detectKey(seq('Am'))).toBeNull();
    expect(detectKey(seq('Am Am Am'))).toBeNull();
    expect(detectKey([])).toBeNull();
  });

  it('не-аккорды пропускаются, а не ломают разбор', () => {
    expect(detectKey(seq('N.C. D A Bm G D'))).toBe('D');
  });

  it('бас slash-аккорда на тональность не влияет', () => {
    // «C/G» — это всё ещё C: бас говорит о голосоведении, а не о тонике.
    expect(detectKey(seq('C F/A Am/E G C F/A Am/E G C'))).toBe('C');
  });

  it('на одних квинтах тональность берётся из состава гаммы', () => {
    // У квинты нет терции, то есть нет и лада. Но гамма и тоника определимы,
    // если чужая нота отсекает лишние варианты: соль-бекар исключает A-мажор,
    // и остаётся Am.
    expect(detectKey(seq('B5 G5 D5 A5 B5 G5 D5 A5'))).toBe('Am');
    expect(detectKey(seq('B5 D#5 G#5 E5 B5 D#5 G#5 E5'))).toBe('E');
  });

  it('разрешение решает, какая нота тоника', () => {
    // Один и тот же набор квинт, разные последние аккорды — разные тоники.
    expect(detectKey(seq('B5 G5 D5 A5 B5 G5 D5 A5'))).toBe('Am');
    expect(detectKey(seq('B5 G5 D5 A5 B5 G5 D5 G5'))).toBe('G');
  });

  it('I–IV–V на квинтах — честный null: мажор от минора не отличить', () => {
    // Это не недоработка, а предел записи. «E5 A5 B5» — это и E-мажор
    // (I–IV–V), и Em (i–iv–v): различает их терция, которой у квинты нет,
    // и обе тональности набирают поровну. Догадка здесь была бы монеткой.
    expect(detectKey(seq('E5 A5 B5 E5 A5 B5 E5'))).toBeNull();
  });

  it('повтор припева не перевешивает разбор', () => {
    // Надбавка за тонику считается по ДОЛЕ звучания, а не за каждое появление:
    // иначе двадцать повторов набирали бы сотню очков и порог обесценивался.
    const once = detectKey(seq('C F Am G C'));
    const many = detectKey(seq(('C F Am G '.repeat(20) + 'C').trim()));
    expect(many).toBe(once);
  });

  it('написание тоники берётся у самой песни', () => {
    // Таблицы предпочитают бемоли, но песня из «A# F#» должна получить «F#»,
    // а не «Gb»: от написания зависит и подпись аккордов после сдвига.
    expect(detectKey(seq('F# A# C# F# A# C# F#'))).toBe('F#');
    expect(detectKey(seq('Gb Bb Db Gb Bb Db Gb'))).toBe('Gb');
  });

  it('результат не зависит от регистра перебора тональностей', () => {
    // Одна и та же песня, записанная задом наперёд по секциям, не обязана
    // давать ту же тонику — но одинаковый вход обязан давать одинаковый выход.
    const song = seq('Am F C G Am F C G Am');
    expect(detectKey(song)).toBe(detectKey([...song]));
  });
});
