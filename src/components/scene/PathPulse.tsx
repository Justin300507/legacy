import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Mesh } from 'three';
import { live } from '../../store/live';
import { geo, noRaycast, pulseMat } from './materials';

const SPEED = 7; // units per second
const PAUSE = 5; // units of travel spent off-path between pulses
const TRAIL = [0, 0.35, 0.7, 1.05];

/** Glowing beads travelling node to node from A to B, looping. */
export function PathPulse({ ids }: { ids: string[] }) {
  const meshes = useRef<(Mesh | null)[]>([]);
  const travelled = useRef(0);

  useFrame((_, dt) => {
    const pts = ids.map((id) => live.get(id));
    if (pts.some((p) => !p) || pts.length < 2) return;
    const lens = pts.slice(1).map((p, i) => p!.distanceTo(pts[i]!));
    const total = lens.reduce((a, b) => a + b, 0);
    travelled.current = (travelled.current + dt * SPEED) % (total + PAUSE);
    TRAIL.forEach((lag, k) => {
      const m = meshes.current[k];
      if (!m) return;
      let d = travelled.current - lag;
      m.visible = d >= 0 && d <= total;
      if (!m.visible) return;
      let i = 0;
      while (i < lens.length - 1 && d > lens[i]) d -= lens[i++];
      m.position.lerpVectors(pts[i]!, pts[i + 1]!, lens[i] ? d / lens[i] : 0);
      m.scale.setScalar(1 - k * 0.2);
    });
  });

  return (
    <>
      {TRAIL.map((_, k) => (
        <mesh key={k} ref={(m) => void (meshes.current[k] = m)} geometry={geo.pulse} material={pulseMat} raycast={noRaycast} visible={false} />
      ))}
    </>
  );
}
