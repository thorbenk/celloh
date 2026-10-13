import type { Meta, StoryObj } from '@storybook/html-vite';
import { useEffect } from 'storybook/preview-api';
import { App } from '../app';
import { requireElement } from './dom';

interface Args {
  width: number;
  height: number;
  key: string;
  piano: boolean;
  intonation: boolean;
  diagnostics: boolean;
}

const meta = {
  title: 'Layout/Workspace',
  args: {
    width: 390,
    height: 700,
    key: '',
    piano: false,
    intonation: false,
    diagnostics: false,
  },
  argTypes: {
    width: { control: { type: 'range', min: 280, max: 1280, step: 10 } },
    height: { control: { type: 'range', min: 400, max: 900, step: 10 } },
    key: { control: 'select', options: ['', 'Es-Dur', 'D-Dur'] },
  },
  render: (args) => {
    const root = document.createElement('div');
    root.id = 'app';
    root.style.width = `${args.width}px`;
    root.style.maxWidth = '100%';
    root.style.height = `${args.height}px`;
    useEffect(() => {
      const app = new App(root);
      const toggle = requireElement('#piano-toggle', HTMLButtonElement, root);
      if ((toggle.getAttribute('aria-expanded') === 'true') !== args.piano) toggle.click();
      if (args.intonation) requireElement('#intonation-toggle', HTMLButtonElement, root).click();
      if (args.diagnostics)
        requireElement('.pitch-diagnostics-toggle', HTMLButtonElement, root).click();
      if (args.key) {
        const select = requireElement('#key', HTMLSelectElement, root);
        select.value = args.key;
        select.dispatchEvent(new Event('change'));
      }
      return () => app.destroy();
    }, [args]);
    return root;
  },
} satisfies Meta<Args>;

export default meta;
type Story = StoryObj<Args>;
export const Portrait: Story = {};
export const ShortPortrait: Story = { args: { height: 500 } };
export const WithKeySignature: Story = { args: { height: 500, key: 'Es-Dur' } };
export const Desktop: Story = { args: { width: 1280, height: 800 } };
export const WithPiano: Story = { args: { piano: true } };
export const ShortPortraitWithPiano: Story = {
  args: { height: 500, key: 'Es-Dur', piano: true },
};
export const DesktopWithPiano: Story = { args: { width: 1280, height: 800, piano: true } };

export const Intonation: Story = { args: { intonation: true } };

export const IntonationDiagnostics: Story = { args: { intonation: true, diagnostics: true } };
