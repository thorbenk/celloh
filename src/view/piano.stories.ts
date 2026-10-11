import type { Meta, StoryObj } from '@storybook/html-vite';
import { useEffect } from 'storybook/preview-api';
import { AppModel } from '../model';
import { MAJOR_KEYS, midiPitch, isPlayablePitch } from '../music';
import { PianoKeyboardView } from './piano';

interface Args {
  width: number;
  pitch: number;
  key: string;
  spelling: 'sharp' | 'flat';
  dimOthers: boolean;
}

const meta = {
  title: 'Components/Piano keyboard',
  args: { width: 390, pitch: -1, key: '', spelling: 'sharp', dimOthers: true },
  argTypes: {
    width: { control: { type: 'range', min: 280, max: 1280, step: 10 } },
    pitch: { control: { type: 'number', min: -1, max: 81 } },
    key: { control: 'select', options: ['', ...MAJOR_KEYS.map((key) => key.name)] },
    spelling: { control: 'select', options: ['sharp', 'flat'] },
  },
  render: (args) => {
    const root = document.createElement('div');
    root.style.width = `${args.width}px`;
    root.style.maxWidth = '100%';
    useEffect(() => {
      const model = new AppModel();
      model.setSpelling(args.spelling);
      model.setKey(MAJOR_KEYS.find((key) => key.name === args.key) ?? null);
      if (isPlayablePitch(args.pitch)) model.selectPiano(midiPitch(args.pitch));
      const view = new PianoKeyboardView((pitch) => {
        model.selectPiano(pitch);
        view.render(model.board, model.selectedPitch, args.dimOthers);
      });
      root.replaceChildren(view.element);
      view.render(model.board, model.selectedPitch, args.dimOthers);
      view.reveal(model.selectedPitch);
      return () => view.destroy();
    }, [args]);
    return root;
  },
} satisfies Meta<Args>;

export default meta;
type Story = StoryObj<Args>;
export const Empty: Story = {};
export const NaturalSelection: Story = { args: { pitch: 57 } };
export const BlackKeySelection: Story = { args: { pitch: 58, spelling: 'flat' } };
export const KeySignature: Story = { args: { pitch: 52, key: 'Es-Dur' } };
export const HighestPitch: Story = { args: { pitch: 81 } };
export const Wide: Story = { args: { width: 1100, pitch: 50 } };
