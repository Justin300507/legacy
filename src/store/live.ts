import type { Vector3 } from 'three';

/** Animated (on-screen) node positions, lerped toward layout targets every frame. Mutated, not reactive. */
export const live = new Map<string, Vector3>();

/** True while any node is still travelling, so lines know to rebuild their geometry. */
export const motion = { moving: true };
