import { Vector3 } from 'three';
import type { Vec3 } from './types';

/** Live camera pose, written every frame by CameraRig and read when planning moves. */
export const cam = { position: new Vector3(0, 4, 26), target: new Vector3(), fov: 50, aspect: 16 / 9 };

/** An orbit may carry an explicit `sweep` (radians of azimuth turned); otherwise the shortest way round. */
export type CameraMove = { kind: 'fly' | 'orbit'; position: Vec3; target: Vec3; duration: number; sweep?: number };

// The canvas fills the window; read it live so moves planned before the first resize (initial load on a phone) fit too.
const aspect = () => (typeof window !== 'undefined' && window.innerHeight ? window.innerWidth / window.innerHeight : cam.aspect);

const toVec3 = (v: Vector3): Vec3 => [v.x, v.y, v.z];

const viewDir = () => {
  const d = cam.position.clone().sub(cam.target);
  if (d.lengthSq() < 1e-6) d.set(0, 0.15, 1);
  return d.normalize();
};

/** Fly to `p`, placing it at screen position `at` (NDC, -1..1) so panels don't cover it. */
export function flyToPoint(p: Vector3, distance = 18, at: { x: number; y: number } = { x: 0, y: 0 }): CameraMove {
  const dir = viewDir();
  const right = new Vector3(0, 1, 0).cross(dir).normalize();
  const up = dir.clone().cross(right);
  const tanV = Math.tan(((cam.fov / 2) * Math.PI) / 180);
  const target = p
    .clone()
    .addScaledVector(right, -at.x * tanV * aspect() * distance)
    .addScaledVector(up, -at.y * tanV * distance);
  return { kind: 'fly', target: toVec3(target), position: toVec3(target.clone().addScaledVector(dir, distance)), duration: 1100 };
}

/** Fit points in view. `lift` shifts them up on screen (fraction of radius) to clear a bottom panel. */
export function frame(points: Vector3[], opts: { front?: boolean; duration?: number; lift?: number } = {}): CameraMove {
  if (points.length === 0) return { kind: 'fly', target: [0, 0, 0], position: [0, 3, 22], duration: opts.duration ?? 1000 };
  const min = points[0].clone();
  const max = points[0].clone();
  for (const p of points) {
    min.min(p);
    max.max(p);
  }
  const center = min.clone().add(max).multiplyScalar(0.5);
  const lift = opts.lift ?? 0;
  const radius = (Math.max(...points.map((p) => p.distanceTo(center))) + 2.8) * (1 + lift);
  center.y -= radius * lift;
  const vHalf = ((cam.fov / 2) * Math.PI) / 180;
  const hHalf = Math.atan(Math.tan(vHalf) * aspect());
  const distance = Math.max(8, radius / Math.sin(Math.min(vHalf, hHalf)));
  const dir = opts.front ? new Vector3(0, 0.18, 1).normalize() : viewDir();
  return { kind: 'fly', target: toVec3(center), position: toVec3(center.clone().addScaledVector(dir, distance)), duration: opts.duration ?? 1200 };
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Spin around the anchor and settle on an angled front view of anchor + new spot.
 * Generations spread along X, so side-on views would line siblings up in front of the camera.
 * `az` is the final azimuth; the returned `sweep` (radians) is how far the orbit actually turns.
 */
export function orbitToShow(anchor: Vector3, spot: Vector3, opts: { bottomSheet?: boolean } = {}): CameraMove & { sweep: number } {
  const target = anchor.clone().add(spot).multiplyScalar(0.5);
  const vHalf = ((cam.fov / 2) * Math.PI) / 180;
  const hHalf = Math.atan(Math.tan(vHalf) * aspect());
  const sep = spot.clone().sub(anchor);
  const d = viewDir();
  const curAz = Math.atan2(d.x, d.z);
  const side = sep.x > 0.3 ? -1 : 1; // look slightly from the side opposite the new spot
  const az = side * 0.42;
  let sweep = wrap(az - curAz);
  if (Math.abs(sweep) < Math.PI / 3) sweep += (sweep >= 0 ? 1 : -1) * 2 * Math.PI; // already near the front: full spin
  const el = 0.2;
  // Keep a few node-widths of context either side, even on a narrow phone screen.
  const distance = Math.max(24, sep.length() * 1.8 + 14, (sep.length() + 9) / Math.tan(hHalf) / 2);
  // With a bottom sheet covering the lower half, aim below the pair so they sit in the visible top half.
  if (opts.bottomSheet) target.y -= Math.tan(vHalf) * distance * 0.45;
  const pos = new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(distance).add(target);
  return { kind: 'orbit', target: toVec3(target), position: toVec3(pos), duration: 1600, sweep };
}
