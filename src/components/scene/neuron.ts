import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  IcosahedronGeometry,
  ShaderMaterial,
  Vector3,
  type Curve,
} from 'three';
import { ACCENT, type Look } from './materials';

/** Shared clock for every neuron shader; advanced once per frame by the scene. */
export const neuronTime = { value: 0 };

// ---------- deterministic randomness ----------

export function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const randomUnit = (r: () => number) => {
  const z = r() * 2 - 1;
  const a = r() * Math.PI * 2;
  const s = Math.sqrt(1 - z * z);
  return new Vector3(Math.cos(a) * s, Math.sin(a) * s, z);
};

// ---------- dendrite geometry ----------

type Buffers = { pos: number[]; norm: number[]; t: number[]; seed: number[]; index: number[] };

/** Tube whose radius tapers from r0 to r1, carrying "distance from soma" (aT) for the impulse shader. */
function taperedTube(b: Buffers, curve: Curve<Vector3>, r0: number, r1: number, t0: number, t1: number, seed: number, segs = 14, radial = 6) {
  const frames = curve.computeFrenetFrames(segs, false);
  const base = b.pos.length / 3;
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const p = curve.getPointAt(u);
    const r = r0 + (r1 - r0) * Math.pow(u, 0.7);
    const n = frames.normals[i];
    const bn = frames.binormals[i];
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const nx = Math.cos(a) * n.x + Math.sin(a) * bn.x;
      const ny = Math.cos(a) * n.y + Math.sin(a) * bn.y;
      const nz = Math.cos(a) * n.z + Math.sin(a) * bn.z;
      b.pos.push(p.x + nx * r, p.y + ny * r, p.z + nz * r);
      b.norm.push(nx, ny, nz);
      b.t.push(t0 + (t1 - t0) * u);
      b.seed.push(seed);
    }
  }
  for (let i = 0; i < segs; i++)
    for (let j = 0; j < radial; j++) {
      const a = base + i * radial + j;
      const c = base + (i + 1) * radial + j;
      const a2 = base + i * radial + ((j + 1) % radial);
      const c2 = base + (i + 1) * radial + ((j + 1) % radial);
      b.index.push(a, c, a2, a2, c, c2);
    }
}

/** A wandering path from `start` heading along `dir`. */
function wander(r: () => number, start: Vector3, dir: Vector3, length: number, kinks = 3) {
  const pts = [start.clone()];
  const d = dir.clone();
  let p = start.clone();
  for (let k = 0; k < kinks; k++) {
    d.add(randomUnit(r).multiplyScalar(0.45)).normalize();
    p = p.clone().addScaledVector(d, length / kinks);
    pts.push(p);
  }
  return new CatmullRomCurve3(pts, false, 'centripetal');
}

const SOMA_R = 0.95;

function buildDendrites(seed: number): BufferGeometry {
  const r = rng(seed);
  const b: Buffers = { pos: [], norm: [], t: [], seed: [], index: [] };
  const mains = 5 + Math.floor(r() * 3);
  for (let m = 0; m < mains; m++) {
    const dir = randomUnit(r);
    // Keep dendrites off the camera axis so they frame the face rather than cover it.
    dir.z *= 0.55;
    dir.normalize();
    const len = 1.5 + r() * 1.3;
    const main = wander(r, dir.clone().multiplyScalar(SOMA_R * 0.82), dir, len);
    const s = r();
    taperedTube(b, main, 0.13, 0.012, 0, 1, s);
    const branches = 1 + Math.floor(r() * 3);
    for (let k = 0; k < branches; k++) {
      const u = 0.3 + r() * 0.45;
      const at = main.getPointAt(u);
      const tangent = main.getTangentAt(u);
      const bdir = tangent.add(randomUnit(r).multiplyScalar(0.9)).normalize();
      const branch = wander(r, at, bdir, len * (0.35 + r() * 0.3), 2);
      const rStart = 0.13 + (0.012 - 0.13) * Math.pow(u, 0.7);
      taperedTube(b, branch, rStart * 0.75, 0.008, u, 1, s, 10, 5);
      if (r() < 0.5) {
        const v = 0.5 + r() * 0.3;
        const twig = wander(r, branch.getPointAt(v), branch.getTangentAt(v).add(randomUnit(r)).normalize(), len * 0.2, 2);
        taperedTube(b, twig, rStart * 0.35, 0.006, u + (1 - u) * v, 1, s, 6, 4);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(b.pos), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array(b.norm), 3));
  g.setAttribute('aT', new BufferAttribute(new Float32Array(b.t), 1));
  g.setAttribute('aSeed', new BufferAttribute(new Float32Array(b.seed), 1));
  g.setIndex(b.index);
  g.computeBoundingSphere();
  return g;
}

/** A handful of dendrite shapes shared by every node (each node picks one and a rotation). */
export const DENDRITE_VARIANTS = Array.from({ length: 8 }, (_, i) => buildDendrites(9173 + i * 7919));
export const somaGeometry = new IcosahedronGeometry(SOMA_R, 4);

// ---------- shaders ----------

const somaVertex = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  varying vec3 vN;
  varying vec3 vV;
  varying float vNoise;
  void main() {
    vec3 p = position;
    float n = sin(p.x * 4.1 + uTime * 1.3 + uSeed) * sin(p.y * 4.7 + uTime * 0.9) * sin(p.z * 3.9 + uTime * 1.1 + uSeed * 2.0);
    p += normal * n * 0.07;
    vNoise = n;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const somaFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uOpacity;
  varying vec3 vN;
  varying vec3 vV;
  varying float vNoise;
  void main() {
    float rim = pow(1.0 - abs(dot(vN, vV)), 2.2);
    vec3 c = uColor * (0.12 + rim * 2.4 + vNoise * 0.2) * uIntensity;
    gl_FragColor = vec4(c, (0.2 + rim) * uOpacity);
  }
`;

const dendriteVertex = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  attribute float aT;
  attribute float aSeed;
  varying float vT;
  varying float vSeed;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec3 p = position;
    // Slow organic sway, stronger toward the tips.
    float s = aSeed * 6.2831 + uSeed;
    p += vec3(sin(uTime * 0.7 + s), cos(uTime * 0.6 + s * 1.7), sin(uTime * 0.5 + s * 0.6)) * 0.08 * aT * aT;
    vT = aT;
    vSeed = aSeed;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const dendriteFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uOpacity;
  uniform float uFire;
  uniform float uTime;
  uniform float uSeed;
  varying float vT;
  varying float vSeed;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float rim = pow(1.0 - abs(dot(vN, vV)), 1.4);
    // Electrical impulse running out from the soma; idle part of the cycle keeps it intermittent.
    float head = fract(uTime * 0.32 + vSeed * 3.7 + uSeed) * 1.8;
    float spark = exp(-pow((vT - head) * 9.0, 2.0)) * uFire;
    float fade = 1.0 - vT * 0.65;
    vec3 c = uColor * ((0.35 + rim * 1.3) * fade * uIntensity + spark * 4.5);
    gl_FragColor = vec4(c, (0.45 + rim * 0.55) * fade * uOpacity);
  }
`;

type LookParams = { intensity: number; opacity: number; fire: number };

const LOOKS: Record<Look, LookParams> = {
  normal: { intensity: 1, opacity: 1, fire: 1 },
  hover: { intensity: 1.7, opacity: 1, fire: 1.6 },
  selected: { intensity: 2, opacity: 1, fire: 2 },
  dim: { intensity: 0.5, opacity: 0.13, fire: 0 },
  highlight: { intensity: 2.6, opacity: 1, fire: 2.5 },
};

const accent = new Color(ACCENT);

function neuronMaterial(vertexShader: string, fragmentShader: string, look: LookParams, seed = 0) {
  return new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: neuronTime,
      uSeed: { value: seed },
      uColor: { value: accent },
      uIntensity: { value: look.intensity },
      uOpacity: { value: look.opacity },
      uFire: { value: look.fire },
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
}

const looks = Object.keys(LOOKS) as Look[];

/** Materials per look; a few seed variants so neighbouring nodes don't pulse in lockstep. */
export const somaMat = Object.fromEntries(
  looks.map((l) => [l, [0, 1.7, 3.1, 4.4].map((s) => neuronMaterial(somaVertex, somaFragment, LOOKS[l], s))]),
) as Record<Look, ShaderMaterial[]>;

export const dendriteMat = Object.fromEntries(
  looks.map((l) => [l, [0, 0.27, 0.53, 0.81].map((s) => neuronMaterial(dendriteVertex, dendriteFragment, LOOKS[l], s))]),
) as Record<Look, ShaderMaterial[]>;
