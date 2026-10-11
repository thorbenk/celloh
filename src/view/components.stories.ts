import type { Meta, StoryObj } from '@storybook/html-vite';
import { useEffect } from 'storybook/preview-api';
import { AppModel } from '../model';
import { BOARD_NOTES, MAJOR_KEYS } from '../music';
import { mountLayout } from './layout';
import { requireElement } from './dom';
import { FingerboardView } from './fingerboard';
import { CompactStaffView, StaffView } from './staff';
import { DraggableNotation } from './draggable-notation';

interface Args {
  component: 'fingerboard' | 'notation' | 'picker';
  width: number;
  height: number;
  pitch: number;
  toScale: boolean;
  spread: number;
  key: string;
  expanded: boolean;
}

const meta = {
  title: 'Components/Existing views',
  args: {
    component: 'fingerboard',
    width: 390,
    height: 480,
    pitch: -1,
    toScale: false,
    spread: 1,
    key: '',
    expanded: false,
  },
  argTypes: {
    component: { control: 'select', options: ['fingerboard', 'notation', 'picker'] },
    width: { control: { type: 'range', min: 280, max: 1100, step: 10 } },
    height: { control: { type: 'range', min: 240, max: 800, step: 10 } },
    pitch: { control: { type: 'number', min: -1, max: 81 } },
    key: { control: 'select', options: ['', ...MAJOR_KEYS.map((key) => key.name)] },
  },
  render: (args) => {
    const root = document.createElement('div');
    root.style.width = `${args.width}px`;
    root.style.maxWidth = '100%';
    root.style.height = `${args.height}px`;
    // Reuse production markup; remove the shell before mounting any component behavior.
    mountLayout(root);
    const selector = {
      fingerboard: '.board-card',
      notation: '#notation-display',
      picker: '.note-widget',
    }[args.component];
    const component = requireElement(selector, HTMLElement, root);
    root.replaceChildren(component);
    if (args.component === 'fingerboard') {
      requireElement('#notation-display', HTMLElement, root).remove();
    } else if (args.component === 'notation') {
      const canvas = document.createElement('div');
      canvas.className = 'board-scroll-wrap';
      canvas.append(component);
      root.replaceChildren(canvas);
      if (args.expanded) component.classList.add('expanded');
    }
    useEffect(() => {
      const model = new AppModel();
      model.board.toScale = args.toScale;
      model.board.spread = args.spread;
      model.setKey(MAJOR_KEYS.find((key) => key.name === args.key) ?? null);
      const selected = BOARD_NOTES.find((note) => note.midi === args.pitch);
      if (selected) model.selectBoard(selected);
      if (args.component === 'fingerboard') {
        const view = new FingerboardView(root);
        view.renderNotes(model.board);
        view.renderPositions(model.board);
        view.highlight(model.selectedPitch, model.dimOthers, model.board.key);
        const observer = view.observeResize(model.board);
        return () => observer.disconnect();
      } else if (args.component === 'notation') {
        const view = new CompactStaffView(root);
        view.render(model.selection?.note ?? null);
        const drag = new DraggableNotation(root);
        return () => drag.destroy();
      } else {
        new StaffView(root).renderSelection(model);
      }
    }, [args]);
    return root;
  },
} satisfies Meta<Args>;

export default meta;
type Story = StoryObj<Args>;

export const Fingerboard: Story = {};
export const ExactPitch: Story = { args: { pitch: 50 } };
export const ScaledFingerboard: Story = { args: { toScale: true, spread: 0.6 } };
export const KeySignature: Story = { args: { key: 'Es-Dur', pitch: 52 } };
export const WideFingerboard: Story = { args: { width: 1000, height: 600 } };
export const NotationPreview: Story = { args: { component: 'notation', pitch: 36 } };
export const HighNotation: Story = {
  args: { component: 'notation', pitch: 81, expanded: true },
};
export const NotePicker: Story = { args: { component: 'picker', pitch: 59 } };
