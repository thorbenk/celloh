import type { Meta, StoryObj } from '@storybook/html-vite';
import { useEffect } from 'storybook/preview-api';
import { MAJOR_KEYS, MINOR_KEYS, midiPitch } from '../music';
import { SequenceModel, type SequenceEditor } from '../sequence';
import { NOTE_VALUES, quarterBeats } from '../rhythm';
import { PitchSequenceView } from './pitch-sequence';

interface Args {
  width: number;
  pitches: number[];
  pitch: number;
  key: string;
  mode: SequenceEditor['mode'];
  mixedDurations: boolean;
}

const meta = {
  title: 'Components/Pitch sequence',
  args: {
    width: 390,
    pitches: [50, 52, 54, 55, 57, 59, 61, 62],
    pitch: 50,
    key: '',
    mode: 'capture',
    mixedDurations: false,
  },
  argTypes: {
    width: { control: { type: 'range', min: 280, max: 1280, step: 10 } },
    pitch: { control: { type: 'number', min: 36, max: 81 } },
    mode: { control: 'select', options: ['capture', 'replace', 'insert'] },
    key: {
      control: 'select',
      options: ['', ...MAJOR_KEYS, ...MINOR_KEYS].map((key) =>
        typeof key === 'string' ? key : key.name,
      ),
    },
  },
  render: (args) => {
    const root = document.createElement('div');
    root.style.width = `${args.width}px`;
    root.style.maxWidth = '100%';
    useEffect(() => {
      const sequence = new SequenceModel();
      for (const pitch of args.pitches) sequence.input(midiPitch(pitch));
      if (args.mixedDurations) {
        sequence.dispatch({ type: 'edit' });
        for (let i = 0; i < sequence.notes.length; i++) {
          sequence.dispatch({ type: 'select', index: i });
          sequence.dispatch({ type: 'duration', value: NOTE_VALUES[i % NOTE_VALUES.length] ?? 4 });
          if (i % 2) sequence.dispatch({ type: 'dot' });
        }
        sequence.dispatch({ type: 'done' });
      }
      if (args.mode !== 'capture') {
        sequence.dispatch({ type: 'edit' });
        sequence.dispatch({ type: 'select', index: 2 });
        if (args.mode === 'replace' || args.mode === 'insert')
          sequence.dispatch({ type: args.mode });
      }
      const key = [...MAJOR_KEYS, ...MINOR_KEYS].find((key) => key.name === args.key) ?? null;
      let index: number | null = null;
      let timer: number | undefined;
      const stop = (): void => {
        window.clearTimeout(timer);
        index = null;
      };
      const advance = (): void => {
        const note = index === null ? undefined : sequence.notes[index];
        if (!note) stop();
        else
          timer = window.setTimeout(
            () => {
              index = (index ?? 0) + 1;
              advance();
            },
            500 * quarterBeats(note.duration),
          );
        view.render(sequence, key, index);
      };
      const view = new PitchSequenceView(
        (action) => {
          stop();
          sequence.dispatch(action);
          view.render(sequence, key);
        },
        () => {
          if (index !== null) stop();
          else {
            index = sequence.selectedIndex ?? 0;
            advance();
          }
          view.render(sequence, key, index);
        },
      );
      const add = document.createElement('button');
      add.textContent = 'Ton hinzufügen';
      const events = new AbortController();
      add.addEventListener(
        'click',
        () => {
          stop();
          sequence.input(midiPitch(args.pitch));
          view.render(sequence, key);
        },
        { signal: events.signal },
      );
      root.replaceChildren(view.element, add);
      view.render(sequence, key);
      return () => {
        stop();
        events.abort();
        view.destroy();
      };
    }, [args]);
    return root;
  },
} satisfies Meta<Args>;

export default meta;
type Story = StoryObj<Args>;
export const Default: Story = {};
export const Empty: Story = { args: { pitches: [] } };
export const SharpKey: Story = { args: { key: 'D-Dur', pitches: [54, 53, 53, 54, 66, 65, 66] } };
export const FlatKey: Story = { args: { key: 'Es-Dur', pitches: [51, 52, 52, 51, 58, 59, 58] } };
export const ExtremeRange: Story = { args: { pitches: [36, 37, 50, 58, 81], pitch: 57 } };
export const LongHistory: Story = {
  args: { pitches: Array.from({ length: 40 }, (_, i) => 48 + (i % 12)) },
};
export const SevenFlats: Story = { args: { key: 'Ces-Dur', pitches: [36, 59, 81] } };
export const Editing: Story = { args: { mode: 'replace', mixedDurations: true, width: 820 } };
export const NarrowEditing: Story = { args: { mode: 'replace', mixedDurations: true, width: 320 } };
export const Replacing: Story = { args: { mode: 'replace' } };
export const Inserting: Story = { args: { mode: 'insert', mixedDurations: true } };
export const EmptyEditing: Story = { args: { pitches: [], mode: 'replace' } };
