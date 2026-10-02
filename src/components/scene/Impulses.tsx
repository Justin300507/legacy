import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, ShaderMaterial, type Points } from 'three';
import { fibers } from './fibers';
import { ACCENT } from './materials';
import { neuronTime } from './neuron';

const CAPACITY_STEP = 256;

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aGlow;
  varying float vGlow;
  void main() {
    vGlow = aGlow;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = min(aSize * 300.0 / -mv.z, 16.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vGlow;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float core = exp(-d * d * 18.0);
    float halo = exp(-d * d * 3.5) * 0.35;
    vec3 c = mix(uColor, vec3(1.0), core * 0.6) * (core * 2.6 + halo * 0.9) * vGlow;
    gl_FragColor = vec4(c, core + halo);
  }
`;

const quad = (a: number, b: number, c: number, t: number) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;

/** Electrical impulses travelling along every fibre, parent → child. One draw call for all of them. */
export function Impulses() {
  const points = useRef<Points>(null);
  const capacity = useRef(0);
  const geometry = useMemo(() => new BufferGeometry(), []);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: { uColor: { value: new Color(ACCENT) } },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  );

  useFrame(() => {
    const t = neuronTime.value;
    const needed = fibers.size * 2;
    if (needed > capacity.current) {
      capacity.current = Math.ceil(needed / CAPACITY_STEP) * CAPACITY_STEP;
      geometry.setAttribute('position', new BufferAttribute(new Float32Array(capacity.current * 3), 3));
      geometry.setAttribute('aSize', new BufferAttribute(new Float32Array(capacity.current), 1));
      geometry.setAttribute('aGlow', new BufferAttribute(new Float32Array(capacity.current), 1));
    }
    if (!capacity.current) return;
    const pos = geometry.getAttribute('position') as BufferAttribute;
    const size = geometry.getAttribute('aSize') as BufferAttribute;
    const glow = geometry.getAttribute('aGlow') as BufferAttribute;
    let n = 0;
    for (const f of fibers.values()) {
      if (f.style === 'dim') continue;
      const hot = f.style === 'highlight';
      const pulses = hot ? 2 : 1;
      for (let k = 0; k < pulses; k++) {
        // Travel then rest, so the network fires intermittently rather than streaming.
        const u = (t * f.speed * (hot ? 2.2 : 1) + f.phase + k / pulses) % 1 * (hot ? 1 : 1.7);
        if (u > 1) continue;
        pos.setXYZ(n, quad(f.start.x, f.mid.x, f.end.x, u), quad(f.start.y, f.mid.y, f.end.y, u), quad(f.start.z, f.mid.z, f.end.z, u));
        const swell = Math.sin(u * Math.PI);
        size.setX(n, (hot ? 1.1 : 0.7) * (0.6 + 0.4 * swell));
        glow.setX(n, (hot ? 1.4 : 0.8) * (0.3 + 0.7 * swell));
        n++;
      }
    }
    geometry.setDrawRange(0, n);
    pos.needsUpdate = size.needsUpdate = glow.needsUpdate = true;
    if (points.current) points.current.visible = n > 0;
  });

  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} raycast={() => null} />;
}
