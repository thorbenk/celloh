import template from './layout.html?raw';
import brandIconUrl from '../assets/brand-icon.webp';
import brandEmblemUrl from '../assets/brand-emblem.webp';
import { POSITIONS } from '../music';
import { requireElement } from './dom';

export function mountLayout(root: HTMLElement): void {
  root.innerHTML = template
    .replaceAll('{{brandIcon}}', brandIconUrl)
    .replaceAll('{{brandEmblem}}', brandEmblemUrl);
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
