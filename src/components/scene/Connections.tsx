import { QuadraticBezierLine } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { memo, useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, Vector3 } from 'three';
import type { Line2 } from 'three-stdlib';
import { parentsOf, partnersOf } from '../../lib/graph';
import { useFamily } from '../../store/family';
import { live, motion } from '../../store/live';
import { fibers, type LineStyle } from './fibers';
import { ABOVE_RING, BELOW_LABEL, curveMid, trimToRings } from './lines';
import { blue } from './materials';
import { hashString } from './neuron';

type BezierRef = Line2 & { setPoints: (start: Vector3, end: Vector3, mid: Vector3) => void };

const ORIGIN = new Vector3();

const CORE = { normal: blue(1.8), highlight: blue(6), dim: blue(1) };
const GLOW = blue(1);

export const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

type Ends = (start: Vector3, end: Vector3, mid: Vector3) => boolean;

/** One nerve fibre: a soft wide glow plus a bright thin core, following live node positions. */
const Fiber = memo(function Fiber({ id, ends, style }: { id: string; ends: Ends; style: LineStyle }) {
  const glow = useRef<BezierRef>(null);
  const core = useRef<BezierRef>(null);
  const built = useRef(false);
  const fiber = useMemo(() => {
    const h = hashString(id);
    return { start: new Vector3(), mid: new Vector3(), end: new Vector3(), style: 'normal' as LineStyle, phase: (h % 1000) / 1000, speed: 0.22 + ((h >>> 10) % 100) / 700 };
  }, [id]);
  useEffect(() => {
    fiber.style = style;
  }, [fiber, style]);

  useFrame(() => {
    if (!glow.current || !core.current) return;
    if (!motion.moving && built.current) return;
    if (!ends(fiber.start, fiber.end, fiber.mid)) return;
    glow.current.setPoints(fiber.start, fiber.end, fiber.mid);
    core.current.setPoints(fiber.start, fiber.end, fiber.mid);
    fibers.set(id, fiber);
    built.current = true;
  });

  useEffect(() => {
    built.current = false;
  }, [ends]);
  useEffect(() => () => void fibers.delete(id), [id]);

  const highlight = style === 'highlight';
  const dim = style === 'dim';
  return (
    <group>
      <QuadraticBezierLine
        ref={glow as never}
        start={ORIGIN}
        end={ORIGIN}
        color={GLOW}
        lineWidth={highlight ? 11 : 7}
        transparent
        opacity={dim ? 0.03 : highlight ? 0.45 : 0.16}
        blending={AdditiveBlending}
        depthWrite={false}
      />
      <QuadraticBezierLine
        ref={core as never}
        start={ORIGIN}
        end={ORIGIN}
        color={CORE[style]}
        lineWidth={highlight ? 2.6 : 1.4}
        transparent
        opacity={dim ? 0.12 : 1}
        blending={AdditiveBlending}
        depthWrite={false}
      />
    </group>
  );
});

/** All partner and parent→child fibres. `pathEdges` get highlighted, the rest dimmed, while a path is shown. */
export function Connections({ pathEdges }: { pathEdges: Set<string> | null }) {
  const relationships = useFamily((s) => s.relationships);
  const index = useFamily((s) => s.index);

  const specs = useMemo(() => {
    const out: { id: string; edges: string[]; ends: Ends }[] = [];
    const seen = new Set<string>();
    for (const r of relationships) {
      if (r.type !== 'partner') continue;
      const key = edgeKey(r.a, r.b);
      if (!index.ids.has(r.a) || !index.ids.has(r.b) || seen.has(key)) continue;
      seen.add(key);
      const { a, b } = r;
      out.push({
        id: `p:${key}`,
        edges: [key],
        ends: (start, end, mid) => {
          const pa = live.get(a);
          const pb = live.get(b);
          if (!pa || !pb) return false;
          trimToRings(pa, pb, start, end);
          mid.lerpVectors(start, end, 0.5).y -= 0.35; // a slight sag, like a hanging fibre
          return true;
        },
      });
    }
    for (const [child, parents] of index.parents) {
      // A couple's child hangs from the middle of their partner fibre; otherwise one fibre per parent.
      const groups =
        parents.length === 2 && partnersOf(index, parents[0]).includes(parents[1]) ? [[...parents]] : parentsOf(index, child).map((p) => [p]);
      for (const from of groups) {
        out.push({
          id: `c:${child}<${from.join('+')}`,
          edges: from.map((p) => edgeKey(p, child)),
          ends: (start, end, mid) => {
            const pc = live.get(child);
            const ps = from.map((id) => live.get(id));
            if (!pc || ps.some((p) => !p)) return false;
            if (ps.length === 2) start.addVectors(ps[0]!, ps[1]!).multiplyScalar(0.5);
            else start.copy(ps[0]!).y -= BELOW_LABEL;
            end.copy(pc).y += ABOVE_RING;
            curveMid(start, end, mid);
            return true;
          },
        });
      }
    }
    return out;
  }, [relationships, index]);

  return (
    <>
      {specs.map((s) => (
        <Fiber key={s.id} id={s.id} ends={s.ends} style={!pathEdges ? 'normal' : s.edges.some((e) => pathEdges.has(e)) ? 'highlight' : 'dim'} />
      ))}
    </>
  );
}
