import { Line, QuadraticBezierLine } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { memo, useMemo, useRef } from 'react';
import { Vector3 } from 'three';
import type { Line2, LineMaterial } from 'three-stdlib';
import { parentsOf, partnersOf } from '../../lib/graph';
import { useFamily } from '../../store/family';
import { live, motion } from '../../store/live';
import { ABOVE_RING, BELOW_LABEL, curveMid, DASH, DASH_SPEED, trimToRings } from './lines';
import { ACCENT, blue } from './materials';

export type LineStyle = 'normal' | 'dim' | 'highlight';

type BezierRef = Line2 & { setPoints: (start: Vector3, end: Vector3, mid: Vector3) => void };

const PLACEHOLDER: [number, number, number][] = [
  [0, 0, 0],
  [0, 0.001, 0],
];
const ORIGIN = new Vector3();
const HIGHLIGHT = blue(6);

const styleProps = (style: LineStyle) => ({
  color: style === 'highlight' ? HIGHLIGHT : ACCENT,
  lineWidth: style === 'highlight' ? 3.2 : 1.6,
  transparent: true,
  opacity: style === 'dim' ? 0.15 : 1,
});

export const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

const tmpA = new Vector3();
const tmpB = new Vector3();

const PartnerLine = memo(function PartnerLine({ a, b, style }: { a: string; b: string; style: LineStyle }) {
  const ref = useRef<Line2>(null);
  const built = useRef(false);
  useFrame((_, dt) => {
    const line = ref.current;
    const pa = live.get(a);
    const pb = live.get(b);
    if (!line || !pa || !pb) return;
    if (motion.moving || !built.current) {
      trimToRings(pa, pb, tmpA, tmpB);
      line.geometry.setPositions([tmpA.x, tmpA.y, tmpA.z, tmpB.x, tmpB.y, tmpB.z]);
      line.computeLineDistances();
      built.current = true;
    }
    (line.material as LineMaterial).dashOffset -= dt * DASH_SPEED;
  });
  return <Line ref={ref} points={PLACEHOLDER} dashed {...DASH} {...styleProps(style)} />;
});

const ChildLine = memo(function ChildLine({ from, child, style }: { from: string[]; child: string; style: LineStyle }) {
  const ref = useRef<BezierRef>(null);
  const built = useRef(false);
  const start = useMemo(() => new Vector3(), []);
  const end = useMemo(() => new Vector3(), []);
  const mid = useMemo(() => new Vector3(), []);
  useFrame((_, dt) => {
    const line = ref.current;
    const pc = live.get(child);
    const ps = from.map((id) => live.get(id));
    if (!line || !pc || ps.some((p) => !p)) return;
    if (motion.moving || !built.current) {
      if (ps.length === 2) start.addVectors(ps[0]!, ps[1]!).multiplyScalar(0.5);
      else start.copy(ps[0]!).y -= BELOW_LABEL;
      end.copy(pc).y += ABOVE_RING;
      line.setPoints(start, end, curveMid(start, end, mid));
      line.computeLineDistances();
      built.current = true;
    }
    (line.material as LineMaterial).dashOffset -= dt * DASH_SPEED;
  });
  return <QuadraticBezierLine ref={ref as never} start={ORIGIN} end={ORIGIN} dashed {...DASH} {...styleProps(style)} />;
});

/** All partner and parent→child lines. `path` edges get highlighted, the rest dimmed, when a path is shown. */
export function Connections({ pathEdges }: { pathEdges: Set<string> | null }) {
  const relationships = useFamily((s) => s.relationships);
  const index = useFamily((s) => s.index);

  const { partners, children } = useMemo(() => {
    const partners: { key: string; a: string; b: string }[] = [];
    const seen = new Set<string>();
    for (const r of relationships) {
      if (r.type !== 'partner') continue;
      const key = edgeKey(r.a, r.b);
      if (!index.ids.has(r.a) || !index.ids.has(r.b) || seen.has(key)) continue;
      seen.add(key);
      partners.push({ key, a: r.a, b: r.b });
    }
    const children: { key: string; child: string; from: string[] }[] = [];
    for (const [child, parents] of index.parents) {
      // A couple's child hangs from the middle of their partner line; otherwise one line per parent.
      if (parents.length === 2 && partnersOf(index, parents[0]).includes(parents[1])) {
        children.push({ key: `${child}<${edgeKey(parents[0], parents[1])}`, child, from: [...parents] });
      } else {
        for (const p of parentsOf(index, child)) children.push({ key: `${child}<${p}`, child, from: [p] });
      }
    }
    return { partners, children };
  }, [relationships, index]);

  const styleOf = (edges: string[]): LineStyle =>
    !pathEdges ? 'normal' : edges.some((e) => pathEdges.has(e)) ? 'highlight' : 'dim';

  return (
    <>
      {partners.map((l) => (
        <PartnerLine key={l.key} a={l.a} b={l.b} style={styleOf([l.key])} />
      ))}
      {children.map((l) => (
        <ChildLine key={l.key} child={l.child} from={l.from} style={styleOf(l.from.map((p) => edgeKey(p, l.child)))} />
      ))}
    </>
  );
}
