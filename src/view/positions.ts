import { POSITIONS, fingerOffsets, type Position, type PositionVariant } from '../music';
import type { BoardSettings } from '../model';
import { rowY, NOTE_RADIUS } from './geometry';

type BracketVariant = PositionVariant | 'standard';
const BRACKET_CAP_WIDTH = 22;
const FINGER_RADIUS = 8;
const BRACKET_EDGE_MARGIN = 22;
const BRACKET_LANE_SPACING = 34;
const OUTER_LANE_X = BRACKET_EDGE_MARGIN;
const MIDDLE_LANE_X = OUTER_LANE_X + BRACKET_LANE_SPACING;
const INNER_LANE_X = MIDDLE_LANE_X + BRACKET_LANE_SPACING;
const FINGER_INSET = 12;
const LABEL_OUTSET = 8;
const LABEL_ROTATION = 90;
const EXTENSION_LABEL_GAP = 10;
const EXTENSION_DASH_LENGTH = 4;
const BRACKET_STROKE_WIDTH = 2;

function variantsFor(position: Position, settings: BoardSettings): readonly BracketVariant[] {
  if (position.id === 1 || position.id === 4) return ['standard'];
  return [...settings.variants];
}

/** Each bracket gets a separate lane: three on either side of the strings. */
function bracketX(position: Position, variant: BracketVariant, width: number): number {
  switch (position.id) {
    case 1:
      return INNER_LANE_X;
    case 2:
      return width - (variant === 'upper' ? MIDDLE_LANE_X : INNER_LANE_X);
    case 3:
      return variant === 'upper' ? OUTER_LANE_X : MIDDLE_LANE_X;
    case 4:
      return width - OUTER_LANE_X;
  }
}

function fingerMarkup(
  offset: number,
  finger: number,
  x: number,
  color: string,
  settings: BoardSettings,
): string {
  const y = rowY(offset, settings);
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
  const start = rowY(normal[0], settings) - NOTE_RADIUS;
  const end = rowY(normal[3], settings) + NOTE_RADIUS;
  const x = bracketX(position, variant, width);
  const direction = position.side === 'left' ? 1 : -1;
  const capX = x + direction * BRACKET_CAP_WIDTH;
  const fingerX = x + direction * FINGER_INSET;
  const labelX = x - direction * LABEL_OUTSET;
  const rotation = -direction * LABEL_ROTATION;
  const label =
    variant === 'standard'
      ? `${position.id}. Lage`
      : `${position.id}. ${upper ? 'obere' : 'untere'}`;

  let extension = '';
  if (settings.extended) {
    const top = rowY(normal[0] - 1, settings) - NOTE_RADIUS;
    extension = `
      <path class="extension-bracket" stroke-dasharray="${EXTENSION_DASH_LENGTH} ${EXTENSION_DASH_LENGTH}" d="M${x},${start} V${top} H${capX}"/>
      <text class="extension-text" x="${fingerX}" y="${top - EXTENSION_LABEL_GAP}" stroke="none" fill="${position.color}" text-anchor="middle">↑ (1)</text>
    `;
  }
  return `
    <g class="position-overlay" data-position="${position.id}" data-variant="${variant}" stroke="${position.color}" fill="none" stroke-width="${BRACKET_STROKE_WIDTH}">
      <path class="position-bracket" d="M${capX},${start} H${x} V${end} H${capX}"/>
      ${extension}
      <text class="position-label" transform="translate(${labelX} ${(start + end) / 2}) rotate(${rotation})" text-anchor="middle" stroke="none" fill="${position.color}">${label}</text>
      ${fingers.map((offset, index) => fingerMarkup(offset, index + 1, fingerX, position.color, settings)).join('')}
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
