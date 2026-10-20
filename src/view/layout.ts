import template from './layout.html?raw';
import bravuraLicenseUrl from '../assets/bravura-LICENSE.txt?url';
import iconsLicenseUrl from '../assets/material-icons-LICENSE.txt?url';
import vexflowLicenseUrl from '../assets/vexflow-LICENSE.txt?url&no-inline';
import brandIconUrl from '../assets/brand-icon.webp';
import brandEmblemUrl from '../assets/brand-emblem.webp';
import {
  MAJOR_KEYS,
  MINOR_KEYS,
  POSITIONS,
  POSITION_NAMINGS,
  positionName,
  type PositionNaming,
} from '../music';
import { requireElement } from './dom';

export function mountLayout(root: HTMLElement): void {
  root.innerHTML = template
    .replaceAll('{{brandIcon}}', brandIconUrl)
    .replaceAll('{{brandEmblem}}', brandEmblemUrl)
    .replaceAll('{{bravuraLicense}}', bravuraLicenseUrl)
    .replaceAll('{{vexflowLicense}}', vexflowLicenseUrl)
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
  const rows = requireElement('#position-comparison-rows', HTMLTableSectionElement, root);
  const notes = ['E–F–Fis–G', 'F–Fis–G–Gis', 'Fis–G–Gis–A', 'G–As–A–B', 'As–A–B–H', 'A–B–H–C'];
  let index = 0;
  for (const position of POSITIONS) {
    for (const upper of position.id === 2 || position.id === 3 ? [false, true] : [false]) {
      const names = POSITION_NAMINGS.map(
        (naming, i) =>
          `<div>${positionName(position.id, upper, naming)} <small>(${['App', 'Schmidt', 'Wolf'][i]})</small></div>`,
      ).join('');
      rows.insertAdjacentHTML(
        'beforeend',
        `<tr><th scope="row">${notes[index++]}</th><td>${names}</td></tr>`,
      );
    }
  }
  renderPositionLabels(root, 'wolf');
}

export function renderPositionLabels(root: HTMLElement, naming: PositionNaming): void {
  for (const position of POSITIONS) {
    for (const upper of position.id === 2 || position.id === 3 ? [false, true] : [false]) {
      const selector =
        position.id === 2 || position.id === 3
          ? `#position-${position.id}-${upper ? 'upper' : 'lower'}`
          : `input[data-position="${position.id}"]`;
      const input = requireElement(selector, HTMLInputElement, root);
      const name = positionName(position.id, upper, naming);
      input.setAttribute('aria-label', `${name} anzeigen`);
      requireElement(`${selector} ~ span:last-child`, HTMLSpanElement, root).textContent = name;
    }
  }
}
