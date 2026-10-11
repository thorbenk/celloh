import type { Meta, StoryObj } from '@storybook/html-vite';
import { useEffect } from 'storybook/preview-api';
import { App } from '../app';
import { requireElement } from './dom';

interface Args {
  width: number;
  height: number;
  key: string;
}

const meta = {
  title: 'Layout/Workspace',
  args: { width: 390, height: 700, key: '' },
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
