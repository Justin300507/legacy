import { Billboard, Html, Line, Text } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useMemo, useRef, type ReactNode } from 'react';
import { MeshBasicMaterial, Vector3, type Group } from 'three';
import type { Line2, LineMaterial } from 'three-stdlib';
import { lineAnchorIds, PLACEHOLDER_NAME } from '../../lib/addRelative';
import { FADE_MS } from '../../store/actions';
import { useFamily } from '../../store/family';
import { live } from '../../store/live';
import type { AddFlow } from '../../store/ui';
import { ABOVE_RING, BELOW_LABEL, CURVE_SEGMENTS, curveMid, DASH, DASH_SPEED, partialCurve, trimToRings } from './lines';
import { ACCENT, blue, FONT, geo, haloMat, noRaycast } from './materials';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Timeline (ms after the form stage starts) for the add-relative reveal. */
export const SPIN_MS = 1500;
export const GHOST_AT = 1100;
const LINE_AT = 1350;
const LINE_MS = 800;
export const FORM_AT = 1800;

type RingProps = {
  position: () => Vector3 | undefined;
  opacity: () => number;
  label?: string;
  size?: number;
  onClick?: () => void;
  children?: ReactNode;
};

/** Pulsing empty blue ring with a "+" — where a new person will go. */
export function GhostRing({ position, opacity, label, size = 1, onClick, children }: RingProps) {
  const group = useRef<Group>(null);
  const mat = useMemo(() => new MeshBasicMaterial({ color: blue(1.6), transparent: true, opacity: 0 }), []);
  const halo = useMemo(() => haloMat.hover.clone(), []);
  const texts = useRef<({ fillOpacity: number } | null)[]>([]);

  useFrame(({ clock }) => {
    const g = group.current;
    const p = position();
    if (!g || !p) return;
    const o = opacity();
    const pulse = Math.sin(clock.elapsedTime * 4);
    g.position.copy(p);
    g.visible = o > 0.001;
    g.scale.setScalar(size * (0.8 + 0.2 * o + 0.05 * pulse));
    mat.opacity = o * (0.75 + 0.25 * pulse);
    halo.opacity = o * (0.55 + 0.35 * pulse);
    for (const t of texts.current) if (t) t.fillOpacity = o;
  });

  const click = onClick
    ? (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onClick();
      }
    : undefined;

  return (
    <group ref={group} visible={false}>
      <Billboard>
        <mesh geometry={geo.halo} material={halo} position-z={-0.05} raycast={noRaycast} />
        <group
          onClick={click}
          onPointerOver={click && (() => void (document.body.style.cursor = 'pointer'))}
          onPointerOut={click && (() => void (document.body.style.cursor = ''))}
        >
          <mesh geometry={geo.hit} visible={false} />
          <mesh geometry={geo.ring} material={mat} />
          <Text ref={(t) => void (texts.current[0] = t as never)} font={FONT} fontSize={1} color={ACCENT} anchorX="center" anchorY="middle" position-y={0.06}>
            +
          </Text>
        </group>
        {label && (
          <Text
            ref={(t) => void (texts.current[1] = t as never)}
            font={FONT}
            fontSize={0.34}
            color="#ffffff"
            anchorX="center"
            anchorY="top"
            position-y={-1.22}
            raycast={noRaycast}
          >
            {label}
          </Text>
        )}
      </Billboard>
      {children}
    </group>
  );
}

const PLACEHOLDER = Array.from({ length: CURVE_SEGMENTS + 1 }, (_, i): [number, number, number] => [0, i * 0.001, 0]);

/** The add-relative reveal: ghost node, self-drawing connection line, and (on desktop) the form beside it. */
export function AddGhost({ flow, form }: { flow: AddFlow; form: ReactNode | null }) {
  const index = useFamily((s) => s.index);
  const anchors = useMemo(() => lineAnchorIds(index, flow.anchorId, flow.relation!, flow), [index, flow]);
  const lineRef = useRef<Line2>(null);
  const v = useMemo(() => ({ start: new Vector3(), end: new Vector3(), mid: new Vector3(), a: new Vector3(), b: new Vector3() }), []);
  const delay = flow.relation === 'first' ? 0 : 1;

  const fade = () => (flow.closingAt ? 1 - clamp01((performance.now() - flow.closingAt) / FADE_MS) : 1);
  const appear = () => clamp01((performance.now() - flow.startedAt - GHOST_AT * delay) / 400);

  useFrame((_, dt) => {
    const line = lineRef.current;
    if (!line) return;
    const ghost = live.get(flow.newId);
    const ps = anchors.map((id) => live.get(id));
    const progress = easeOut(clamp01((performance.now() - flow.startedAt - LINE_AT) / LINE_MS));
    line.visible = !!ghost && ps.length > 0 && ps.every(Boolean) && progress > 0.01;
    if (!line.visible) return;
    const { start, end, mid } = v;
    if (flow.relation === 'partner') {
      trimToRings(ps[0]!, ghost!, start, end);
      mid.lerpVectors(start, end, 0.5);
    } else if (flow.relation === 'parent') {
      start.copy(ps[0]!).y += ABOVE_RING;
      end.copy(ghost!).y -= BELOW_LABEL - 0.6;
      curveMid(start, end, mid);
    } else {
      if (ps.length === 2) start.addVectors(ps[0]!, ps[1]!).multiplyScalar(0.5);
      else start.copy(ps[0]!).y -= flow.placeholderId ? ABOVE_RING : BELOW_LABEL;
      end.copy(ghost!).y += ABOVE_RING;
      curveMid(start, end, mid);
    }
    line.geometry.setPositions(partialCurve(start, mid, end, progress));
    line.computeLineDistances();
    const m = line.material as LineMaterial;
    m.opacity = fade();
    m.dashOffset -= dt * DASH_SPEED;
  });

  return (
    <>
      <GhostRing position={() => live.get(flow.newId)} opacity={() => appear() * fade()}>
        {form && (
          <Html zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
            <div className="ghost-form-anchor">{form}</div>
          </Html>
        )}
      </GhostRing>
      {flow.placeholderId && (
        <GhostRing
          position={() => live.get(flow.placeholderId!)}
          opacity={() => appear() * fade() * 0.7}
          label={PLACEHOLDER_NAME}
          size={0.85}
        />
      )}
      {/* No `visible` prop: drei spreads extra props onto the material too, which would hide it for good. */}
      <Line ref={lineRef} points={PLACEHOLDER} dashed {...DASH} color={blue(2)} lineWidth={2.2} transparent />
    </>
  );
}
