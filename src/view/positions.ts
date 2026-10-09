import { POSITIONS, fingerOffsets, type Position, type PositionVariant } from '../music';
import type { BoardSettings } from '../model';
import { rowY, NOTE_RADIUS } from './geometry';

type BracketVariant = PositionVariant | 'standard';
const BRACKET_CAP_WIDTH = 22;
const FINGER_RADIUS = 8;

function variantsFor(position: Position, settings: BoardSettings): readonly BracketVariant[] {
  if (position.id === 1 || position.id === 4) return ['standard'];
  return [...settings.variants];
}

/** Each bracket gets a separate lane: three on either side of the strings. */
function bracketX(position: Position, variant: BracketVariant, width: number): number {
  switch (position.id) {
    case 1:
      return 90;
    case 2:
      return width - (variant === 'upper' ? 56 : 90);
    case 3:
      return variant === 'upper' ? 22 : 56;
    case 4:
      return width - 22;
  }
}

function fingerMarkup(offset: number, finger: number, x: number, color: string): string {
  const y = rowY(offset);
  return `
    <circle class="finger-marker" cx="${x}" cy="${y}" r="${FINGER_RADIUS}" fill="${color}" stroke="none"/>
    <text class="finger-number" x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" fill="white" stroke="none">${finger}</text>
  `;
}

function bracketMarkup(
  position: Position,
  variant: BracketVariant,
  settings: BoardSettings,
  width: number,
): string {
  const upper = variant === 'upper';
  const normal = fingerOffsets(position.id, upper, false);
  const fingers = fingerOffsets(position.id, upper, settings.extended);
  const start = rowY(normal[0]) - NOTE_RADIUS;
  const end = rowY(normal[3]) + NOTE_RADIUS;
  const x = bracketX(position, variant, width);
  const direction = position.side === 'left' ? 1 : -1;
  const capX = x + direction * BRACKET_CAP_WIDTH;
  const fingerX = x + direction * 12;
  const labelX = x - direction * 8;
  const rotation = position.side === 'left' ? -90 : 90;
  const label =
    variant === 'standard'
      ? `${position.id}. Lage`
      : `${position.id}. ${upper ? 'obere' : 'untere'}`;

  let extension = '';
  if (settings.extended) {
    const top = rowY(normal[0] - 1) - NOTE_RADIUS;
    extension = `
      <path class="extension-bracket" stroke-dasharray="4 4" d="M${x},${start} V${top} H${capX}"/>
      <text class="extension-text" x="${fingerX}" y="${top - 10}" stroke="none" fill="${position.color}" text-anchor="middle">↑ (1)</text>
    `;
  }
  return `
    <g class="position-overlay" data-position="${position.id}" data-variant="${variant}" stroke="${position.color}" fill="none" stroke-width="2">
      <path class="position-bracket" d="M${capX},${start} H${x} V${end} H${capX}"/>
      ${extension}
      <text class="position-label" transform="translate(${labelX} ${(start + end) / 2}) rotate(${rotation})" text-anchor="middle" stroke="none" fill="${position.color}">${label}</text>
      ${fingers.map((offset, index) => fingerMarkup(offset, index + 1, fingerX, position.color)).join('')}
    </g>
  `;
}

/** Pure SVG rendering; all lane and finger coordinates are in fingerboard pixels. */
export function positionMarkup(settings: BoardSettings, width: number): string {
  return POSITIONS.filter((position) => settings.visiblePositions.has(position.id))
    .flatMap((position) =>
      variantsFor(position, settings).map((variant) =>
        bracketMarkup(position, variant, settings, width),
      ),
    )
    .join('');
}
