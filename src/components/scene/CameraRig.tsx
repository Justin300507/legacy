import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Spherical, Vector3, type PerspectiveCamera } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { cam } from '../../lib/camera';
import { useUI } from '../../store/ui';

const easeCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
// Gentler peak speed for spins, which can cover a full turn.
const easeSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

type Anim = {
  kind: 'fly' | 'orbit';
  start: number;
  duration: number;
  fromPos: Vector3;
  toPos: Vector3;
  fromTarget: Vector3;
  toTarget: Vector3;
  s0: Spherical;
  s1: Spherical;
  sweep: number;
};

/** Plays camera moves from the UI store over OrbitControls, and publishes the live pose. */
export function CameraRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null;
  const size = useThree((s) => s.size);
  const move = useUI((s) => s.cameraMove);
  const anim = useRef<Anim | null>(null);
  const sph = useRef(new Spherical());

  useEffect(() => {
    cam.aspect = size.width / Math.max(1, size.height);
    cam.fov = camera.fov;
  }, [size, camera]);

  useEffect(() => {
    if (!move || !controls) return;
    const toPos = new Vector3(...move.position);
    const toTarget = new Vector3(...move.target);
    const s0 = new Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    const s1 = new Spherical().setFromVector3(toPos.clone().sub(toTarget));
    anim.current = {
      kind: move.kind,
      start: performance.now(),
      duration: move.duration,
      fromPos: camera.position.clone(),
      toPos,
      fromTarget: controls.target.clone(),
      toTarget,
      s0,
      s1,
      // Land exactly on the final azimuth while turning the requested amount.
      sweep: move.sweep !== undefined ? move.sweep + wrap(s1.theta - (s0.theta + move.sweep)) : wrap(s1.theta - s0.theta),
    };
    controls.enabled = false;
  }, [move, controls, camera]);

  useFrame(() => {
    const a = anim.current;
    if (a && controls) {
      const t = Math.min(1, (performance.now() - a.start) / a.duration);
      const e = a.kind === 'orbit' ? easeSine(t) : easeCubic(t);
      controls.target.lerpVectors(a.fromTarget, a.toTarget, e);
      if (a.kind === 'orbit') {
        // Swing around the (moving) target in spherical coordinates: a spin rather than a slide.
        sph.current.set(
          a.s0.radius + (a.s1.radius - a.s0.radius) * e,
          a.s0.phi + (a.s1.phi - a.s0.phi) * e,
          a.s0.theta + a.sweep * e,
        );
        camera.position.setFromSpherical(sph.current).add(controls.target);
      } else {
        camera.position.lerpVectors(a.fromPos, a.toPos, e);
      }
      camera.lookAt(controls.target);
      if (t >= 1) {
        anim.current = null;
        controls.enabled = true;
        controls.update();
      }
    }
    cam.position.copy(camera.position);
    if (controls) cam.target.copy(controls.target);
  });

  return null;
}
