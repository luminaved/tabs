// Переводит квинты из записи «лад + В/Н» в стандартные имена: 5В → A5, 7Н → E5.
//
// Запуск:
//   node scripts/normalize-power-chords.mjs           — только показать, что будет
//   node scripts/normalize-power-chords.mjs --apply    — записать в базу
//
// Зачем. Запись «5В» читается только внутри традиции русских табов, а главное —
// её не понимает разбор аккордов (lib/chords/chord.ts ждёт корень A-G). Значит
// такой аккорд молча НЕ транспонируется: тональность песни едет, а он стоит на
// месте. После переименования транспонирование в этих разборах начинает
// работать, а аппликатура берётся автоматически (powerChordFrets).
//
// ГЛАВНОЕ ПРАВИЛО: картинки не меняются. Где автоматическая форма отличается от
// нынешней, старая закрепляется на песне в chordDefs — она главнее встроенных.
// Поэтому после миграции разбор выглядит ровно так же, как выглядел.
//
// Логика повторяет lib/chords/diagrams.ts (там она покрыта тестами, включая
// таблицу соответствий «старое имя → новое имя → та же форма»). Скрипты в
// проекте — .mjs без сборки, поэтому TypeScript-модуль напрямую не
// импортируется; при изменении правил поправить надо оба места.
import { PrismaClient } from '@prisma/client';

const APPLY = process.argv.includes('--apply');

// ─── Повтор логики из lib/chords ───────────────────────────────────────────

const SIXTH_STRING_PC = 4; // открытая 6-я струна, E
const FIFTH_STRING_PC = 9; // открытая 5-я струна, A
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const NATURAL_FLAT_MAJORS = new Set(['F']);
const NATURAL_FLAT_MINORS = new Set(['C', 'D', 'F', 'G']);

const mod12 = (n) => ((n % 12) + 12) % 12;

/** «5В» → { fret: 5, upper: true }; иначе null. */
function parsePowerFifth(name) {
  const m = /^(\d{1,2})([ВНвнBHbh])$/.exec(name.trim());
  if (!m) return null;
  const fret = Number(m[1]);
  // Ноль допустим — открытая струна: «0В» = E5, «0Н» = A5.
  if (fret < 0 || fret > 22) return null;
  return { fret, upper: /[ВвBb]/.test(m[2]) };
}

/** Аппликатура ровно той позиции, которую задаёт запись «лад + В/Н». */
function powerFifthFrets({ fret, upper }) {
  return upper ? [fret, fret + 2, fret + 2, -1, -1, -1] : [-1, fret, fret + 2, fret + 2, -1, -1];
}

/** Аппликатура квинты по высоте корня: до 5 лада — 6-я струна, дальше — 5-я. */
function powerChordFrets(rootPc) {
  const sixth = mod12(rootPc - SIXTH_STRING_PC);
  if (sixth <= 5) return [sixth, sixth + 2, sixth + 2, -1, -1, -1];
  const fifth = mod12(rootPc - FIFTH_STRING_PC);
  return [-1, fifth, fifth + 2, fifth + 2, -1, -1];
}

/** Диез или бемоль по тональности песни: знак в названии главнее. */
function accidentalForKey(name) {
  const m = /^([A-G][#b]*)(m|min|minor)?$/.exec((name ?? '').trim());
  if (!m) return 'sharp';
  if (m[1].includes('b')) return 'flat';
  if (m[1].includes('#')) return 'sharp';
  const flats = m[2] !== undefined ? NATURAL_FLAT_MINORS : NATURAL_FLAT_MAJORS;
  return flats.has(m[1][0]) ? 'flat' : 'sharp';
}

/** «5В» → «A5». */
function powerFifthToChordName(name, accidental) {
  const ref = parsePowerFifth(name);
  if (!ref) return null;
  const open = ref.upper ? SIXTH_STRING_PC : FIFTH_STRING_PC;
  const names = accidental === 'flat' ? FLAT_NAMES : SHARP_NAMES;
  return names[mod12(open + ref.fret)] + '5';
}

// ─── Разбор аппликатур с песни ─────────────────────────────────────────────

/** chordDefs хранит либо массив ладов, либо { frets, barres } — берём лады. */
function fretsOf(def) {
  if (Array.isArray(def)) return def;
  if (def && typeof def === 'object' && Array.isArray(def.frets)) return def.frets;
  return null;
}

const sameFrets = (a, b) => a.length === b.length && a.every((n, i) => n === b[i]);

// ─── Обход разборов ────────────────────────────────────────────────────────

const prisma = new PrismaClient();

const songs = await prisma.song.findMany({
  select: { id: true, title: true, artist: true, key: true, body: true, chordDefs: true, instrument: true },
  orderBy: { createdAt: 'asc' },
});

let changed = 0;
let pinned = 0;
const skipped = [];

for (const song of songs) {
  // Запись «лад + В/Н» считает лады от 6-й и 5-й струн, которых на укулеле
  // нет, — там такие имена ничего не рисуют (Instrument.fifthShorthand).
  // Сами квинты на укулеле есть и форму получают по имени («A5»).
  const guitar = song.instrument !== 'ukulele';

  const tokens = [...song.body.matchAll(/\[([^\]\n]+)\]/g)]
    .map((m) => m[1].trim())
    .filter((name) => parsePowerFifth(name));
  const oldNames = [...new Set(tokens)];
  if (oldNames.length === 0) continue;

  const label = `${song.title}${song.artist ? ` — ${song.artist}` : ''}`;

  if (!guitar) {
    skipped.push(`${label}: запись квинт в разборе для укулеле (${oldNames.join(', ')}) — глазами`);
    continue;
  }

  const accidental = accidentalForKey(song.key);
  let defs = {};
  try {
    const parsed = JSON.parse(song.chordDefs ?? '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) defs = parsed;
  } catch {
    skipped.push(`${label}: не разобрался chordDefs — глазами`);
    continue;
  }

  // Что рисуется СЕЙЧАС: своя форма с песни, если задана, иначе — позиция из
  // самой записи. Именно это и надо сохранить.
  const plan = new Map(); // новое имя → { frets, from: [старые имена] }
  let collision = null;

  for (const old of oldNames) {
    const ref = parsePowerFifth(old);
    const current = fretsOf(defs[old]) ?? powerFifthFrets(ref);
    const rootPc = mod12((ref.upper ? SIXTH_STRING_PC : FIFTH_STRING_PC) + ref.fret);
    const next = powerFifthToChordName(old, accidental);

    const seen = plan.get(next);
    if (seen && !sameFrets(seen.frets, current)) {
      // Два разных старых имени дают одно новое, но разные картинки (напр. 5В и
      // 17В — оба A5). Одним именем это не выразить: имя несёт высоту корня, но
      // не позицию. Такую песню не трогаем совсем — чинить руками.
      collision = `${label}: ${seen.from.join('/')} и ${old} оба дают ${next}, но с разными аппликатурами`;
      break;
    }
    if (seen) seen.from.push(old);
    else plan.set(next, { frets: current, rootPc, from: [old] });
  }

  if (collision) {
    skipped.push(collision);
    continue;
  }

  // Переименование в тексте. Заменяем только целые токены аккордов, а не любое
  // вхождение подстроки: «5В» может встретиться и в словах песни. Пробелы
  // внутри скобок допускаем — то же правило, что в lib/chordpro/powerFifths.ts.
  const body = song.body.replace(/\[([^\]\n]+)\]/g, (full, inner) => {
    const next = powerFifthToChordName(inner.trim(), accidental);
    return next ? `[${next}]` : full;
  });

  // Аппликатуры. Старые ключи убираем всегда (иначе форма осталась бы висеть
  // под именем, которого в тексте больше нет), новые заводим только там, где
  // автоматическая форма отличается от нынешней.
  const nextDefs = { ...defs };
  for (const old of oldNames) delete nextDefs[old];

  const pins = [];
  for (const [next, { frets, rootPc }] of plan) {
    const auto = powerChordFrets(rootPc);
    if (sameFrets(auto, frets)) continue;
    // Своя форма уже могла быть задана под новым именем — её не перебиваем.
    if (nextDefs[next] === undefined) nextDefs[next] = frets;
    pins.push(`${next} → ${frets.map((f) => (f < 0 ? 'x' : f)).join(' ')}`);
  }

  const chordDefs = Object.keys(nextDefs).length ? JSON.stringify(nextDefs) : null;
  const renames = [...plan].map(([next, { from }]) => `${from.join('/')} → ${next}`).join(', ');

  console.log(`• ${label}`);
  console.log(`    ${renames}`);
  if (pins.length) console.log(`    аппликатура закреплена: ${pins.join('; ')}`);

  changed++;
  pinned += pins.length;

  if (APPLY) {
    // Через $executeRaw, а не update: у Song стоит @updatedAt, а по нему
    // версионируются ссылки на обложки и строится карта сайта — служебная
    // правка названий не должна это ворошить.
    await prisma.$executeRaw`
      UPDATE "Song" SET "body" = ${body}, "chordDefs" = ${chordDefs} WHERE "id" = ${song.id}
    `;
  }
}

// searchText пересобирать не нужно: он собирается с вырезанными [аккордами]
// (см. stripChordPro), поэтому переименование его не меняет.

console.log('');
console.log(`Разборов всего: ${songs.length}, со старой записью квинт: ${changed}`);
console.log(`Аппликатур закреплено: ${pinned}`);
if (skipped.length) {
  console.log('');
  console.log('Пропущено (нужны руки):');
  for (const line of skipped) console.log(`  — ${line}`);
}
console.log('');
console.log(APPLY ? 'Записано в базу.' : 'Это был показ. Записать: --apply');

await prisma.$disconnect();
