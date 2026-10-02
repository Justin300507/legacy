import { useMemo } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, ShaderMaterial } from 'three';
import { ACCENT } from './materials';
import { neuronTime } from './neuron';

const COUNT = 2600;

const vertexShader = /* glsl */ `
  uniform float uTime;
  attribute float aSeed;
  attribute float aSize;
  varying float vTwinkle;
  varying float vSeed;
  void main() {
    vec3 p = position;
    float s = aSeed * 6.2831;
    p += vec3(sin(uTime * 0.07 + s), cos(uTime * 0.05 + s * 1.3), sin(uTime * 0.06 + s * 0.7)) * 2.5;
    vTwinkle = 0.55 + 0.45 * sin(uTime * (0.6 + aSeed) + s * 3.0);
    vSeed = aSeed;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    // Clamp so motes drifting past the lens never balloon into blobs; fade the very close ones.
    gl_PointSize = min(aSize * 260.0 / -mv.z, 5.0);
    vTwinkle *= smoothstep(6.0, 18.0, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vTwinkle;
  varying float vSeed;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = exp(-d * d * 6.0);
    vec3 c = mix(uColor, vec3(0.75, 0.88, 1.0), step(0.85, vSeed)) * a * vTwinkle;
    gl_FragColor = vec4(c * 0.55, a);
  }
`;

/** Drifting, twinkling motes around the tree — the "neural soup" backdrop. */
export function Dust({ radius }: { radius: number }) {
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    const pos = new Float32Array(COUNT * 3);
    const seed = new Float32Array(COUNT);
    const size = new Float32Array(COUNT);
    let s = 12345;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = (r() * 2 - 1) * radius * 1.4;
      pos[i * 3 + 1] = (r() * 2 - 1) * radius * 0.8;
      pos[i * 3 + 2] = (r() * 2 - 1) * radius * 1.2;
      seed[i] = r();
      size[i] = 0.08 + Math.pow(r(), 4) * 0.5;
    }
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new BufferAttribute(seed, 1));
    g.setAttribute('aSize', new BufferAttribute(size, 1));
    return g;
  }, [radius]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: { uTime: neuronTime, uColor: { value: new Color(ACCENT) } },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  );

  return <points geometry={geometry} material={material} frustumCulled={false} raycast={() => null} />;
}
