import { Billboard, Text } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { memo, useEffect, useRef } from 'react';
import type { Group } from 'three';
import type { Person } from '../../lib/types';
import { clickPerson } from '../../store/actions';
import { live } from '../../store/live';
import { useUI } from '../../store/ui';
import { discMat, FONT, geo, haloMat, noRaycast, ringMat, type Look } from './materials';
import { usePhotoMaterial } from './photoCache';

export type NodeState = 'normal' | 'dim' | 'highlight';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';

type Props = { person: Person; state: NodeState; selected: boolean; hovered: boolean };

export const PersonNode = memo(function PersonNode({ person, state, selected, hovered }: Props) {
  const group = useRef<Group>(null);
  const scale = useRef(0); // grows to 1 on mount: the scale-in animation
  const photo = usePhotoMaterial(person);
  const dim = state === 'dim';
  const look: Look = dim ? 'dim' : state === 'highlight' ? 'highlight' : selected ? 'selected' : hovered ? 'hover' : 'normal';

  useEffect(() => {
    if (photo) photo.opacity = dim ? 0.15 : 1;
  }, [photo, dim]);

  useFrame((_, dt) => {
    const g = group.current;
    const p = live.get(person.id);
    if (!g || !p) return;
    g.position.copy(p);
    const target = hovered && !dim ? 1.1 : 1;
    scale.current += (target - scale.current) * (1 - Math.exp(-dt * 9));
    g.scale.setScalar(scale.current);
  });

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    useUI.getState().hover(person.id);
    document.body.style.cursor = 'pointer';
  };
  const out = () => {
    if (useUI.getState().hoveredId === person.id) useUI.getState().hover(null);
    document.body.style.cursor = '';
  };
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    clickPerson(person.id);
  };

  const textOpacity = dim ? 0.15 : 1;

  return (
    <group ref={group} scale={0}>
      <Billboard>
        <mesh geometry={geo.halo} material={haloMat[look]} position-z={-0.05} raycast={noRaycast} renderOrder={-1} />
        <group onPointerOver={over} onPointerOut={out} onClick={click}>
          <mesh geometry={geo.hit} visible={false} />
          <mesh geometry={geo.disc} material={photo ?? (dim ? discMat.dim : discMat.solid)} />
          <mesh geometry={selected ? geo.ringThick : geo.ring} material={ringMat[look]} position-z={0.01} />
          {!photo && (
            <Text font={FONT} fontSize={0.52} color="#ffffff" fillOpacity={textOpacity} anchorX="center" anchorY="middle" position-z={0.02}>
              {initials(person.name)}
            </Text>
          )}
        </group>
        <Text
          font={FONT}
          fontSize={0.34}
          maxWidth={3.4}
          textAlign="center"
          color="#ffffff"
          fillOpacity={textOpacity}
          anchorX="center"
          anchorY="top"
          position={[0, -RING_LABEL_GAP, 0]}
          raycast={noRaycast}
        >
          {person.name || 'Unnamed'}
        </Text>
      </Billboard>
    </group>
  );
});

const RING_LABEL_GAP = 1.22;
