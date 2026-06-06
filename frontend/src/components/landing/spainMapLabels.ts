export type LabelPosition = 'below' | 'above' | 'right' | 'left';

export interface LabelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LabelCandidate {
  position: LabelPosition;
  anchorX: number;   // SVG <text> x attribute (always text-anchor="middle")
  anchorY: number;   // SVG <text> y attribute (baseline)
  rect: LabelRect;   // bounding box for overlap and boundary checks
}

const LABEL_HEIGHT = 13;
const PIN_GAP = 7;

export function computeLabelCandidates(
  px: number,
  py: number,
  pinW: number,
  pinH: number,
  textWidth: number,
): LabelCandidate[] {
  const w = textWidth;
  const h = LABEL_HEIGHT;
  const hw = pinW / 2;
  const hh = pinH / 2;

  return [
    {
      position: 'below',
      anchorX: px,
      anchorY: py + hh + PIN_GAP + h,
      rect: { x: px - w / 2, y: py + hh + PIN_GAP, width: w, height: h },
    },
    {
      position: 'above',
      anchorX: px,
      anchorY: py - hh - PIN_GAP,
      rect: { x: px - w / 2, y: py - hh - PIN_GAP - h, width: w, height: h },
    },
    {
      position: 'right',
      anchorX: px + hw + PIN_GAP + w / 2,
      anchorY: py + h / 2 - 2,
      rect: { x: px + hw + PIN_GAP, y: py - h / 2, width: w, height: h },
    },
    {
      position: 'left',
      anchorX: px - hw - PIN_GAP - w / 2,
      anchorY: py + h / 2 - 2,
      rect: { x: px - hw - PIN_GAP - w, y: py - h / 2, width: w, height: h },
    },
  ];
}

export function rectsOverlap(a: LabelRect, b: LabelRect): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}
