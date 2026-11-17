export type Point = readonly [x: number, y: number];

/** The climbing route on the 320 × 220 mountain drawing, from base to summit. */
export const ROUTE_POINTS: readonly Point[] = [
  [48, 204],
  [112, 176],
  [84, 148],
  [150, 122],
  [128, 96],
  [186, 74],
  [172, 50],
  [204, 24],
];

/** The point a fraction `t` (0–1) of the way along a polyline, by distance. */
export function pointAlong(points: readonly Point[], t: number): Point {
  const first = points[0];
  if (!first) return [0, 0];
  const lengths: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i - 1] as Point;
    const [x2, y2] = points[i] as Point;
    lengths.push(Math.hypot(x2 - x1, y2 - y1));
  }
  const total = lengths.reduce((a, b) => a + b, 0);
  let remaining = Math.min(1, Math.max(0, t)) * total;
  for (let i = 0; i < lengths.length; i++) {
    const length = lengths[i] as number;
    const [x1, y1] = points[i] as Point;
    const [x2, y2] = points[i + 1] as Point;
    if (remaining <= length && length > 0) {
      const f = remaining / length;
      return [x1 + (x2 - x1) * f, y1 + (y2 - y1) * f];
    }
    remaining -= length;
  }
  return points[points.length - 1] as Point;
}
