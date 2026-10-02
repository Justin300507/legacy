import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Vector3 } from 'three';
import { clickBackground, startAdd } from '../../store/actions';
import { useFamily } from '../../store/family';
import { live, motion } from '../../store/live';
import { isGhostStage, useConnectionPath, useLayoutTargets } from '../../store/selectors';
import { useUI } from '../../store/ui';
import { CameraRig } from './CameraRig';
import { Connections, edgeKey } from './Connections';
import { AddGhost, GhostRing } from './Ghost';
import { PathPulse } from './PathPulse';
import { PersonNode, type NodeState } from './PersonNode';
import { prunePhotoCache } from './photoCache';

const ORIGIN = new Vector3();
const ORIGIN_FN = () => ORIGIN;

function SceneContent({ ghostForm }: { ghostForm: ReactNode | null }) {
  const people = useFamily((s) => s.people);
  const loaded = useFamily((s) => s.loaded);
  const mode = useUI((s) => s.mode);
  const selectedId = useUI((s) => s.selectedId);
  const hoveredId = useUI((s) => s.hoveredId);
  const targets = useLayoutTargets();
  const path = useConnectionPath();

  const targetsRef = useRef(targets);
  targetsRef.current = targets;

  // Animate every node toward its layout target; runs before nodes and lines read `live`.
  useFrame((_, dt) => {
    const a = 1 - Math.exp(-dt * 5);
    let moving = false;
    for (const [id, t] of targetsRef.current) {
      const v = live.get(id);
      if (!v) {
        live.set(id, t.clone());
        moving = true;
      } else if (v.distanceToSquared(t) > 1e-6) {
        v.lerp(t, a);
        moving = true;
      }
    }
    for (const id of live.keys()) if (!targetsRef.current.has(id)) live.delete(id);
    motion.moving = moving;
  }, -1);

  useEffect(() => {
    prunePhotoCache(new Set(people.map((p) => p.id)));
  }, [people]);

  const { pathIds, pathEdges, pathOrder } = useMemo(() => {
    if (!path) return { pathIds: null, pathEdges: null, pathOrder: [] as string[] };
    const order = path.length ? [path[0].from, ...path.map((s) => s.to)] : [];
    return { pathIds: new Set(order), pathEdges: new Set(path.map((s) => edgeKey(s.from, s.to))), pathOrder: order };
  }, [path]);

  const stateOf = (id: string): NodeState => (!pathIds ? 'normal' : pathIds.has(id) ? 'highlight' : 'dim');
  const picked = (id: string) => mode.kind === 'connect' && (mode.a === id || mode.b === id);

  return (
    <>
      {people.map((p) => (
        <PersonNode key={p.id} person={p} state={stateOf(p.id)} selected={p.id === selectedId || picked(p.id)} hovered={p.id === hoveredId} />
      ))}
      <Connections pathEdges={pathEdges} />
      {pathOrder.length > 1 && <PathPulse key={pathOrder.join('>')} ids={pathOrder} />}
      {mode.kind === 'add' && isGhostStage(mode) && <AddGhost key={mode.newId} flow={mode} form={ghostForm} />}
      {loaded && people.length === 0 && mode.kind === 'idle' && (
        <GhostRing position={ORIGIN_FN} opacity={() => 1} label="Add the first person" onClick={() => startAdd(null)} />
      )}
    </>
  );
}

export function Scene({ ghostForm }: { ghostForm: ReactNode | null }) {
  return (
    <Canvas
      flat
      dpr={[1, 2]}
      camera={{ fov: 50, position: [0, 4, 26], near: 0.1, far: 10000 }}
      onPointerMissed={clickBackground}
      gl={{ powerPreference: 'high-performance' }}
      onCreated={(state) => {
        if (import.meta.env.DEV) (window as unknown as { __r3f: unknown }).__r3f = state;
      }}
    >
      <color attach="background" args={['#000000']} />
      <SceneContent ghostForm={ghostForm} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={3} maxDistance={4000} />
      <CameraRig />
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.25} intensity={1.3} radius={0.75} />
      </EffectComposer>
    </Canvas>
  );
}
