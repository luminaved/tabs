import { Fragment } from 'react';
import { lineToColumns, lineToPlainText } from '@/lib/chordpro/columns';
import { Section, Segment, Song } from '@/lib/chordpro/types';

/** Интерактивность строк для аннотаций (опционально — обычный рендер без неё). */
export interface LineInteraction {
  onLineClick?: (line: number) => void;
  activeLine?: number | null;
  /** Контент под строкой (список заметок + форма). */
  lineExtras?: (line: number) => React.ReactNode;
}

/**
 * Рендер песни: аккорд строго над своим слогом через inline-block колонки.
 * `song` уже транспонирована/подготовлена вызывающим кодом — компонент чистый.
 */
export function ChordSheet({
  song,
  showChords = true,
  interaction,
  renderChord,
}: {
  song: Song;
  showChords?: boolean;
  interaction?: LineInteraction;
  /** Опц. рендер имени аккорда (напр. с всплывающей аппликатурой). */
  renderChord?: (chord: string) => React.ReactNode;
}) {
  return (
    <div className={showChords ? 'chordsheet' : 'chordsheet chordsheet--nochords'}>
      {song.sections.map((section, i) => (
        <SectionView key={i} section={section} interaction={interaction} renderChord={renderChord} />
      ))}
    </div>
  );
}

const SECTION_CLASS: Record<Section['kind'], string> = {
  chorus: 'cs-section cs-section--chorus',
  bridge: 'cs-section cs-section--bridge',
  verse: 'cs-section',
  tab: 'cs-section cs-section--tab',
  none: 'cs-section',
};

function SectionView({
  section,
  interaction,
  renderChord,
}: {
  section: Section;
  interaction?: LineInteraction;
  renderChord?: (chord: string) => React.ReactNode;
}) {
  // Табулатура: моноширинный блок вместо колоночной раскладки — иначе
  // выравнивание пробелами («e|--3--5--|») разъезжается.
  if (section.kind === 'tab') {
    return (
      <section className={SECTION_CLASS[section.kind]}>
        {section.label ? <div className="cs-label">{section.label}</div> : null}
        <pre className="cs-tab">
          {section.lines
            .map((line) =>
              line.type === 'lyric'
                ? lineToPlainText(line.segments)
                : line.type === 'comment'
                  ? line.text
                  : '',
            )
            .join('\n')}
        </pre>
      </section>
    );
  }

  return (
    <section className={SECTION_CLASS[section.kind]}>
      {section.label ? <div className="cs-label">{section.label}</div> : null}
      {section.lines.map((line) => {
        switch (line.type) {
          case 'lyric':
            return (
              <LyricLineView
                key={line.line}
                line={line.line}
                segments={line.segments}
                interaction={interaction}
                renderChord={renderChord}
              />
            );
          case 'comment':
            return (
              <p key={line.line} className="cs-comment">
                {line.text}
              </p>
            );
          case 'empty':
            return <div key={line.line} className="cs-empty" aria-hidden />;
        }
      })}
    </section>
  );
}

function LyricLineView({
  line,
  segments,
  interaction,
  renderChord,
}: {
  line: number;
  segments: Segment[];
  interaction?: LineInteraction;
  renderChord?: (chord: string) => React.ReactNode;
}) {
  const columns = lineToColumns(segments);
  const clickable = !!interaction?.onLineClick;
  const active = interaction?.activeLine === line;

  // Колонки одного слова (разбитого аккордом) держим вместе: перенос строки —
  // только между словами (по пробелам), внутри слова — никогда.
  const words: (typeof columns)[] = [];
  let current: typeof columns = [];
  for (const col of columns) {
    current.push(col);
    if (col.spaceAfter) {
      words.push(current);
      current = [];
    }
  }
  if (current.length) words.push(current);

  const content =
    columns.length === 0 ? (
      <>&nbsp;</>
    ) : (
      words.map((word, wi) => (
        <Fragment key={wi}>
          <span className="cs-word">
            {word.map((col, ci) => (
              <span key={ci} className="cs-col">
                <span className="cs-chord">
                  {col.chord ? (renderChord ? renderChord(col.chord) : col.chord) : ''}
                </span>
                <span className={col.muted ? 'cs-lyric cs-muted' : 'cs-lyric'}>
                  {col.text || ' '}
                </span>
              </span>
            ))}
          </span>
          {word[word.length - 1]?.spaceAfter ? ' ' : null}
        </Fragment>
      ))
    );

  const className = [
    'cs-line',
    clickable && 'cs-line--interactive',
    active && 'cs-line--active',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      {clickable ? (
        <p
          className={className}
          role="button"
          tabIndex={0}
          aria-expanded={active}
          onClick={() => interaction!.onLineClick!(line)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              interaction!.onLineClick!(line);
            }
          }}
        >
          {content}
        </p>
      ) : (
        <p className={className}>{content}</p>
      )}
      {interaction?.lineExtras?.(line)}
    </>
  );
}
