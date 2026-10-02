import type { Person, Relationship, Step } from './types';

export type GraphIndex = {
  ids: Set<string>;
  parents: Map<string, string[]>;
  children: Map<string, string[]>;
  partners: Map<string, string[]>;
};

const EMPTY: readonly string[] = [];

function push(m: Map<string, string[]>, k: string, v: string) {
  const list = m.get(k);
  if (!list) m.set(k, [v]);
  else if (!list.includes(v)) list.push(v);
}

export function buildIndex(people: Person[], rels: Relationship[]): GraphIndex {
  const ids = new Set(people.map((p) => p.id));
  const parents = new Map<string, string[]>();
  const children = new Map<string, string[]>();
  const partners = new Map<string, string[]>();
  for (const r of rels) {
    if (r.type === 'parent') {
      if (!ids.has(r.parent) || !ids.has(r.child) || r.parent === r.child) continue;
      push(parents, r.child, r.parent);
      push(children, r.parent, r.child);
    } else {
      if (!ids.has(r.a) || !ids.has(r.b) || r.a === r.b) continue;
      push(partners, r.a, r.b);
      push(partners, r.b, r.a);
    }
  }
  return { ids, parents, children, partners };
}

export const parentsOf = (ix: GraphIndex, id: string) => ix.parents.get(id) ?? EMPTY;
export const childrenOf = (ix: GraphIndex, id: string) => ix.children.get(id) ?? EMPTY;
export const partnersOf = (ix: GraphIndex, id: string) => ix.partners.get(id) ?? EMPTY;

/** Half siblings: both have two known parents and share exactly one. */
export function isHalfSibling(ix: GraphIndex, a: string, b: string): boolean {
  const pa = parentsOf(ix, a);
  const pb = parentsOf(ix, b);
  const shared = pa.filter((p) => pb.includes(p)).length;
  return shared === 1 && pa.length === 2 && pb.length === 2;
}

export function siblingsOf(ix: GraphIndex, id: string): { id: string; half: boolean }[] {
  const seen = new Set<string>();
  const out: { id: string; half: boolean }[] = [];
  for (const p of parentsOf(ix, id)) {
    for (const c of childrenOf(ix, p)) {
      if (c === id || seen.has(c)) continue;
      seen.add(c);
      out.push({ id: c, half: isHalfSibling(ix, id, c) });
    }
  }
  return out;
}

export function neighbors(ix: GraphIndex, id: string): Step[] {
  return [
    ...parentsOf(ix, id).map((to): Step => ({ from: id, to, kind: 'parent' })),
    ...childrenOf(ix, id).map((to): Step => ({ from: id, to, kind: 'child' })),
    ...partnersOf(ix, id).map((to): Step => ({ from: id, to, kind: 'partner' })),
  ];
}

/**
 * Shortest path treating edges as undirected. Among equally short paths,
 * blood paths win over ones through partners (so siblings aren't reported as
 * "parent's partner's child").
 */
export function findPath(ix: GraphIndex, a: string, b: string): Step[] | null {
  if (!ix.ids.has(a) || !ix.ids.has(b)) return null;
  if (a === b) return [];
  const dist = new Map<string, number>([[a, 0]]);
  const prev = new Map<string, Step>();
  const done = new Set<string>();
  const queue = [a];
  while (queue.length) {
    let best = 0;
    for (let i = 1; i < queue.length; i++) if (dist.get(queue[i])! < dist.get(queue[best])!) best = i;
    const cur = queue.splice(best, 1)[0];
    if (done.has(cur)) continue;
    done.add(cur);
    if (cur === b) break;
    for (const step of neighbors(ix, cur)) {
      const cost = dist.get(cur)! + (step.kind === 'partner' ? 101 : 100);
      if (cost < (dist.get(step.to) ?? Infinity)) {
        dist.set(step.to, cost);
        prev.set(step.to, step);
        queue.push(step.to);
      }
    }
  }
  if (!prev.has(b)) return null;
  const path: Step[] = [];
  for (let cur = b; cur !== a; ) {
    const step = prev.get(cur)!;
    path.push(step);
    cur = step.from;
  }
  return path.reverse();
}

export function reversePath(path: Step[]): Step[] {
  return path
    .slice()
    .reverse()
    .map((s) => ({
      from: s.to,
      to: s.from,
      kind: s.kind === 'parent' ? 'child' : s.kind === 'child' ? 'parent' : 'partner',
    }));
}
