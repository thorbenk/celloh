import type { MidiPitch } from './music';
import { QUARTER_NOTE, type NoteDuration, type NoteValue } from './rhythm';

export interface Measure {
  readonly numerator: number;
  readonly denominator: number;
}
export const DEFAULT_MEASURE: Measure = { numerator: 4, denominator: 4 };
export function isMeasure(measure: Measure): boolean {
  return (
    Number.isInteger(measure.numerator) &&
    measure.numerator >= 1 &&
    measure.numerator <= 32 &&
    [1, 2, 4, 8, 16, 32].includes(measure.denominator)
  );
}

export interface SequenceNote {
  readonly pitch: MidiPitch;
  readonly duration: NoteDuration;
}

/** Only insertion has a between-note position; replacement always targets an existing note. */
export type SequenceEditor =
  | { readonly mode: 'capture'; readonly index?: number | null }
  | { readonly mode: 'replace'; readonly index: number | null }
  | { readonly mode: 'insert'; readonly position: number; readonly duration: NoteDuration };

export type SequenceAction =
  | { readonly type: 'import'; readonly notes: readonly SequenceNote[]; readonly measure?: Measure }
  | { readonly type: 'measure'; readonly measure: Measure }
  | { readonly type: 'unselect' }
  | { readonly type: 'edit' }
  | { readonly type: 'done' }
  | { readonly type: 'replace' }
  | { readonly type: 'insert' }
  | { readonly type: 'delete' }
  | { readonly type: 'dot' }
  | { readonly type: 'undo' }
  | { readonly type: 'clear' }
  | { readonly type: 'select'; readonly index: number }
  | { readonly type: 'position'; readonly position: number }
  | { readonly type: 'move'; readonly delta: -1 | 1 }
  | { readonly type: 'jump'; readonly edge: 'beginning' | 'end' }
  | { readonly type: 'duration'; readonly value: NoteValue };

interface Snapshot {
  readonly measure: Measure;
  readonly notes: readonly SequenceNote[];
  readonly editor: SequenceEditor;
}

/** Musical sequence and editing transitions, independent of the DOM and sample playback. */
export class SequenceModel {
  private meter: Measure = DEFAULT_MEASURE;
  get measure(): Measure {
    return this.meter;
  }

  private current: readonly SequenceNote[] = [];
  private state: SequenceEditor = { mode: 'capture' };
  private readonly history: Snapshot[] = [];

  get notes(): readonly SequenceNote[] {
    return this.current;
  }

  get editor(): SequenceEditor {
    return this.state;
  }

  get canUndo(): boolean {
    return this.history.length > 0;
  }

  get selectedIndex(): number | null {
    return this.state.mode === 'insert' ? null : (this.state.index ?? null);
  }

  get selectedNote(): SequenceNote | undefined {
    const index = this.selectedIndex;
    return index === null ? undefined : this.current[index];
  }

  /** Instrument input records, replaces the selected note, or inserts at the cursor. */
  input(pitch: MidiPitch): void {
    const editor = this.state;
    switch (editor.mode) {
      case 'capture':
        this.save();
        this.current = [...this.current, { pitch, duration: QUARTER_NOTE }];
        this.state = { mode: 'capture', index: this.lastIndex() };
        break;
      case 'replace':
        if (editor.index === null) return;
        this.save();
        this.current = this.current.map((note, index) =>
          index === editor.index ? { ...note, pitch } : note,
        );
        break;
      case 'insert':
        this.save();
        this.current = [
          ...this.current.slice(0, editor.position),
          { pitch, duration: editor.duration },
          ...this.current.slice(editor.position),
        ];
        this.state = { ...editor, position: editor.position + 1 };
        break;
    }
  }

  dispatch(action: SequenceAction): void {
    const editor = this.state;
    const index = this.selectedIndex;
    if (
      editor.mode === 'capture' &&
      action.type !== 'import' &&
      action.type !== 'measure' &&
      action.type !== 'unselect' &&
      action.type !== 'select' &&
      action.type !== 'move' &&
      action.type !== 'jump' &&
      action.type !== 'edit' &&
      action.type !== 'done' &&
      action.type !== 'clear' &&
      action.type !== 'undo'
    )
      return;
    switch (action.type) {
      case 'measure':
        if (
          !isMeasure(action.measure) ||
          (this.meter.numerator === action.measure.numerator &&
            this.meter.denominator === action.measure.denominator)
        )
          return;
        this.save();
        this.meter = { ...action.measure };
        return;
      case 'import':
        this.save();
        this.meter = { ...(action.measure ?? DEFAULT_MEASURE) };
        this.current = action.notes.map(({ pitch, duration }) => ({
          pitch,
          duration: { ...duration },
        }));
        this.state = { mode: 'capture' };
        return;
      case 'unselect':
        this.state = { mode: editor.mode === 'capture' ? 'capture' : 'replace', index: null };
        return;
      case 'edit':
        this.state = { mode: 'replace', index: index ?? this.lastIndex() };
        return;
      case 'done':
        this.state = {
          mode: 'capture',
          index:
            index ??
            (editor.mode === 'insert'
              ? Math.min(editor.position, this.current.length - 1)
              : this.lastIndex()),
        };
        if (!this.current.length) this.state = { mode: 'capture' };
        return;
      case 'clear':
        if (!this.current.length) return;
        this.save();
        this.current = [];
        this.state =
          editor.mode === 'capture' ? { mode: 'capture' } : { mode: 'replace', index: null };
        return;
      case 'undo': {
        const previous = this.history.pop();
        if (!previous) return;
        this.current = previous.notes;
        this.meter = previous.measure;
        // Restore the changed location while keeping the user's current editing mode.
        if (editor.mode === 'capture') this.state = { mode: 'capture' };
        else if (editor.mode === 'insert' && previous.editor.mode !== 'insert')
          this.state = { ...editor, position: Math.min(editor.position, this.current.length) };
        else
          switch (previous.editor.mode) {
            case 'capture':
              this.state = { mode: 'replace', index: this.lastIndex() };
              break;
            case 'replace':
              this.state = { mode: 'replace', index: previous.editor.index };
              break;
            case 'insert':
              this.state =
                editor.mode === 'insert'
                  ? previous.editor
                  : {
                      mode: 'replace',
                      index: this.current[previous.editor.position]
                        ? previous.editor.position
                        : this.lastIndex(),
                    };
              break;
          }
        return;
      }
      case 'select':
        if (this.current[action.index])
          this.state =
            editor.mode === 'insert'
              ? { ...editor, position: action.index + 1 }
              : { mode: editor.mode === 'capture' ? 'capture' : 'replace', index: action.index };
        break;
      case 'position':
        if (editor.mode === 'insert')
          this.state = {
            ...editor,
            position: Math.max(0, Math.min(this.current.length, action.position)),
          };
        break;
      case 'jump':
        if (editor.mode === 'insert')
          this.state = {
            ...editor,
            position: action.edge === 'beginning' ? 0 : this.current.length,
          };
        else
          this.state = {
            mode: editor.mode,
            index: action.edge === 'beginning' && this.current.length ? 0 : this.lastIndex(),
          };
        break;
      case 'move':
        if (editor.mode === 'insert') {
          this.state = {
            ...editor,
            position: Math.max(0, Math.min(this.current.length, editor.position + action.delta)),
          };
          break;
        }
        if (index !== null && this.current[index + action.delta])
          this.state = {
            mode: editor.mode === 'capture' ? 'capture' : 'replace',
            index: index + action.delta,
          };
        break;
      case 'replace':
        this.state = {
          mode: 'replace',
          index:
            index ??
            (editor.mode === 'insert' ? Math.max(0, editor.position - 1) : this.lastIndex()),
        };
        if (!this.current.length) this.state = { mode: 'replace', index: null };
        break;
      case 'insert':
        if (editor.mode !== 'insert')
          this.state = {
            mode: 'insert',
            position: index === null ? this.current.length : index + 1,
            duration: this.selectedNote?.duration ?? QUARTER_NOTE,
          };
        break;
      case 'delete':
        if (index === null) return;
        this.save();
        this.current = this.current.filter((_, i) => i !== index);
        this.state = { mode: 'replace', index: this.current[index] ? index : this.lastIndex() };
        break;
      case 'duration':
      case 'dot': {
        const duration = editor.mode === 'insert' ? editor.duration : this.selectedNote?.duration;
        if (!duration) return;
        const next: NoteDuration =
          action.type === 'dot'
            ? { ...duration, dotted: !duration.dotted }
            : { ...duration, value: action.value };
        if (editor.mode === 'insert') this.state = { ...editor, duration: next };
        else if (index !== null) {
          if (next.value === duration.value && next.dotted === duration.dotted) return;
          this.save();
          this.current = this.current.map((note, i) =>
            i === index ? { ...note, duration: next } : note,
          );
        }
        break;
      }
    }
  }

  private lastIndex(): number | null {
    return this.current.length ? this.current.length - 1 : null;
  }

  private save(): void {
    this.history.push({ measure: this.meter, notes: this.current, editor: this.state });
  }
}
