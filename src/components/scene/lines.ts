import { Vector3 } from 'three';
import { RING_R } from './materials';

export const DASH = { dashSize: 0.24, gapSize: 0.17 };
export const DASH_SPEED = 0.45;
/** Child lines start below a lone parent's name label. */
export const BELOW_LABEL = 2.1;
export const ABOVE_RING = RING_R + 0.12;

/** Control point giving parent→child lines a slight curve that leaves the parent vertically. */
export function curveMid(start: Vector3, end: Vector3, out = new Vector3()) {
  out.lerpVectors(start, end, 0.5);
  out.x = start.x * 0.8 + end.x * 0.2;
  out.z = start.z * 0.7 + end.z * 0.3;
  return out;
}

const dir = new Vector3();

/** Trim a segment so it stops at the rings instead of their centres. */
export function trimToRings(a: Vector3, b: Vector3, outA: Vector3, outB: Vector3) {
  dir.subVectors(b, a);
  const len = dir.length();
  if (len < RING_R * 2.2) {
    outA.copy(a);
    outB.copy(b);
    return;
  }
  dir.divideScalar(len);
  outA.copy(a).addScaledVector(dir, RING_R + 0.08);
  outB.copy(b).addScaledVector(dir, -(RING_R + 0.08));
}

export const CURVE_SEGMENTS = 32;

/**
 * Points of the quadratic curve start→mid→end up to fraction `t`. Always returns
 * CURVE_SEGMENTS + 1 points (the tail collapses onto the tip): three caches a Line2's
 * instance count on first render, so the point count must never grow.
 */
export function partialCurve(start: Vector3, mid: Vector3, end: Vector3, t: number, segments = CURVE_SEGMENTS): number[] {
  const out: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const u = Math.min(t, i / segments);
    const a = (1 - u) * (1 - u);
    const b = 2 * (1 - u) * u;
    const c = u * u;
    out.push(a * start.x + b * mid.x + c * end.x, a * start.y + b * mid.y + c * end.y, a * start.z + b * mid.z + c * end.z);
  }
  return out;
}
