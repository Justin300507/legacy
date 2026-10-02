import type { Vector3 } from 'three';

export type LineStyle = 'normal' | 'dim' | 'highlight';

/** Current curve of every connection fibre (start→mid→end), read by the impulse renderer. */
export type FiberState = { start: Vector3; mid: Vector3; end: Vector3; style: LineStyle; phase: number; speed: number };

export const fibers = new Map<string, FiberState>();
