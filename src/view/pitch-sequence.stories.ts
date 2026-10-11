import type { Meta, StoryObj } from '@storybook/html-vite';
import { useEffect } from 'storybook/preview-api';
import { MAJOR_KEYS, MINOR_KEYS, midiPitch } from '../music';
import { PitchSequenceView } from './pitch-sequence';

interface Args {
  width: number;
  pitches: number[];
  pitch: number;
  key: string;
}

const meta = {
  title: 'Components/Pitch sequence',
  args: { width: 390, pitches: [50, 52, 54, 55, 57, 59, 61, 62], pitch: 50, key: '' },
  argTypes: {
    width: { control: { type: 'range', min: 280, max: 1280, step: 10 } },
    pitch: { control: { type: 'number', min: 36, max: 81 } },
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
      const pitches = args.pitches.map(midiPitch);
      const key = [...MAJOR_KEYS, ...MINOR_KEYS].find((key) => key.name === args.key) ?? null;
      let index: number | null = null;
      let timer: number | undefined;
      const stop = (): void => {
        window.clearInterval(timer);
        index = null;
      };
      const view = new PitchSequenceView(
        () => {
          stop();
          pitches.length = 0;
          view.render(pitches, key);
        },
        () => {
          if (index !== null) stop();
          else {
            index = 0;
            timer = window.setInterval(() => {
              index = (index ?? 0) + 1;
              if (index >= pitches.length) stop();
              view.render(pitches, key, index);
            }, 500);
          }
          view.render(pitches, key, index);
        },
      );
      const add = document.createElement('button');
      add.textContent = 'Ton hinzufügen';
      const events = new AbortController();
      add.addEventListener(
        'click',
        () => {
          stop();
          pitches.push(midiPitch(args.pitch));
          view.render(pitches, key);
        },
        { signal: events.signal },
      );
      root.replaceChildren(view.element, add);
      view.render(pitches, key);
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
