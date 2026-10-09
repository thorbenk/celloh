import template from './layout.html?raw';
import brandIconUrl from '../assets/brand-icon.webp';
import brandEmblemUrl from '../assets/brand-emblem.webp';
import { MAJOR_KEYS, MINOR_KEYS, POSITIONS } from '../music';
import { requireElement } from './dom';

export function mountLayout(root: HTMLElement): void {
  root.innerHTML = template
    .replaceAll('{{brandIcon}}', brandIconUrl)
    .replaceAll('{{brandEmblem}}', brandEmblemUrl);
  const keySelect = requireElement('#key', HTMLSelectElement);
  for (const [label, keys] of [
    ['Dur', MAJOR_KEYS],
    ['Moll', MINOR_KEYS],
  ] as const) {
    const group = document.createElement('optgroup');
    group.label = label;
    for (const key of keys) group.append(new Option(key.name, key.name));
    keySelect.append(group);
  }
  const controls = requireElement('#position-controls', HTMLDivElement);
  for (const position of POSITIONS) {
    const label = document.createElement('label');
    label.className = 'position-choice';
    label.style.setProperty('--position', position.color);
    label.innerHTML = `
      <input type="checkbox" data-position="${position.id}" checked>
      <span class="position-dot"></span>
      <span>${position.id}. Lage</span>
      <span class="position-side">${position.side === 'left' ? 'links' : 'rechts'}</span>
    `;
    controls.append(label);
  }
}
