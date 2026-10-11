import type { Meta, StoryObj } from '@storybook/html-vite';
import { useEffect } from 'storybook/preview-api';
import { AppModel } from '../model';
import { midiPitch } from '../music';
import { mountLayout } from './layout';
import { requireElement } from './dom';
import { FingerboardView } from './fingerboard';

interface Args {
  cents: number;
  reliable: boolean;
  wobble: number;
  width: number;
}
const meta = {
  title: 'Components/Pitch feedback',
  args: { cents: 4, reliable: true, wobble: 2, width: 520 },
  argTypes: {
    cents: { control: { type: 'range', min: -100, max: 100, step: 1 } },
    wobble: { control: { type: 'range', min: 0, max: 10, step: 1 } },
    width: { control: { type: 'range', min: 320, max: 1000, step: 10 } },
  },
  render: (args) => {
    const root = document.createElement('div');
    root.style.width = `${args.width}px`;
    root.style.maxWidth = '100%';
    root.style.height = '480px';
    mountLayout(root);
    const board = requireElement('.board-card', HTMLElement, root);
    requireElement('#notation-display', HTMLElement, root).remove();
    root.replaceChildren(board);
    useEffect(() => {
      const model = new AppModel();
      const view = new FingerboardView(root);
      view.renderNotes(model.board);
      view.renderPositions(model.board);
      // D3 has three playable positions; previews use generated measurements, no microphone.
      view.highlight(midiPitch(50), true, null);
      const observer = view.observeResize(model.board);
      const start = performance.now();
      const paint = () =>
        view.pitchFeedback.update(
          args.reliable
            ? args.cents + args.wobble * Math.sin((performance.now() - start) / 150)
            : null,
          true,
          args.reliable,
        );
      paint();
      const timer = window.setInterval(paint, 40);
      return () => {
        window.clearInterval(timer);
        observer.disconnect();
        view.pitchFeedback.update(null, false, false);
      };
    }, [args]);
    return root;
  },
} satisfies Meta<Args>;
export default meta;
type Story = StoryObj<Args>;
export const InTune: Story = {};
export const TooLow: Story = { args: { cents: -18 } };
export const TooHigh: Story = { args: { cents: 32 } };
export const LargeError: Story = { args: { cents: -80 } };
export const Listening: Story = { args: { reliable: false } };
export const Mobile: Story = { args: { width: 390, cents: -18 } };
