import {
  AdditiveBlending,
  CanvasTexture,
  CircleGeometry,
  Color,
  MeshBasicMaterial,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import fontUrl from '@fontsource/inter/files/inter-latin-600-normal.woff?url';

export const FONT = fontUrl;
export const ACCENT = '#2F80FF';
/** Below the bloom threshold (pure white would bloom into a smear). */
export const LABEL_COLOR = '#d3dbea';
export const BLOOM_THRESHOLD = 0.75;
export const RING_R = 0.9;

/** Accent colour scaled into HDR; values above ~4.5 cross the bloom threshold. */
export const blue = (k = 1) => new Color(ACCENT).multiplyScalar(k);

// Shared across every node so 200+ nodes cost a handful of GPU buffers.
export const geo = {
  ring: new TorusGeometry(RING_R, 0.055, 12, 72),
  ringThick: new TorusGeometry(RING_R, 0.12, 12, 72),
  disc: new CircleGeometry(RING_R - 0.03, 48),
  hit: new CircleGeometry(RING_R + 0.2, 24),
  halo: new PlaneGeometry(3.6, 3.6),
  pulse: new SphereGeometry(0.17, 16, 12),
};

function haloTexture() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  const ring = RING_R / 1.8; // ring radius as a fraction of the halo plane's half-width
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(ring - 0.12, 'rgba(255,255,255,0)');
  g.addColorStop(ring, 'rgba(255,255,255,0.9)');
  g.addColorStop(ring + 0.16, 'rgba(255,255,255,0.22)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new CanvasTexture(c);
}

export type Look = 'normal' | 'hover' | 'selected' | 'dim' | 'highlight';

const basic = (color: Color, opacity = 1) => new MeshBasicMaterial({ color, transparent: opacity < 1, opacity });

export const ringMat: Record<Look, MeshBasicMaterial> = {
  normal: basic(blue()),
  hover: basic(blue(1.5)),
  selected: basic(blue(1.7)),
  dim: basic(blue(), 0.15),
  highlight: basic(blue(5)),
};

const haloTex = haloTexture();
const halo = (opacity: number, k = 1) =>
  new MeshBasicMaterial({ map: haloTex, color: blue(k), transparent: true, opacity, blending: AdditiveBlending, depthWrite: false });

export const haloMat: Record<Look, MeshBasicMaterial> = {
  normal: halo(0.3),
  hover: halo(1, 1.4),
  selected: halo(1, 1.5),
  dim: halo(0.05),
  highlight: halo(1, 1.8),
};

export const discMat = {
  solid: new MeshBasicMaterial({ color: '#0d1017' }),
  dim: new MeshBasicMaterial({ color: '#0d1017', transparent: true, opacity: 0.15 }),
};

export const pulseMat = new MeshBasicMaterial({ color: blue(12) });

export const noRaycast = () => null;
