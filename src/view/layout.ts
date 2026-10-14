import template from './layout.html?raw';
import bravuraLicenseUrl from '../assets/bravura-LICENSE.txt?url';
import iconsLicenseUrl from '../assets/material-icons-LICENSE.txt?url';
import brandIconUrl from '../assets/brand-icon.webp';
import brandEmblemUrl from '../assets/brand-emblem.webp';
import { MAJOR_KEYS, MINOR_KEYS, POSITIONS } from '../music';
import { requireElement } from './dom';

export function mountLayout(root: HTMLElement): void {
  root.innerHTML = template
    .replaceAll('{{brandIcon}}', brandIconUrl)
    .replaceAll('{{brandEmblem}}', brandEmblemUrl)
    .replaceAll('{{bravuraLicense}}', bravuraLicenseUrl)
    .replaceAll('{{iconsLicense}}', iconsLicenseUrl);
  const keySelect = requireElement('#key', HTMLSelectElement, root);
  for (const [label, keys] of [
    ['Dur', MAJOR_KEYS],
    ['Moll', MINOR_KEYS],
  ] as const) {
    const group = document.createElement('optgroup');
    group.label = label;
    for (const key of keys) group.append(new Option(key.name, key.id));
    keySelect.append(group);
  }
  const controls = requireElement('#position-controls', HTMLDivElement, root);
  for (const position of POSITIONS) {
    const row = document.createElement('div');
    row.className = 'position-choice-row';
    row.style.setProperty('--switch-color', position.color);
    row.innerHTML = `<label class="position-choice slider-switch" title="${position.side === 'left' ? 'links' : 'rechts'} am Griffbrett"><input type="checkbox" role="switch" data-position="${position.id}" aria-label="${position.id}. Lage anzeigen" checked /><span class="switch-track" aria-hidden="true"></span><span>${position.id}. Lage</span></label>`;
    if (position.id === 2 || position.id === 3) {
      row.replaceChildren();
      for (const variant of ['lower', 'upper'] as const) {
        const label = document.createElement('label');
        label.className = 'position-variant slider-switch';
        label.innerHTML = `<input id="position-${position.id}-${variant}" type="checkbox" role="switch" aria-label="${position.id}. Lage ${variant === 'lower' ? 'unten' : 'oben'}" ${variant === 'lower' ? 'checked' : ''} /><span class="switch-track" aria-hidden="true"></span><span>${variant === 'lower' ? `${position.id}. Lage unten` : 'oben'}</span>`;
        row.append(label);
      }
    }
    controls.append(row);
  }
}
