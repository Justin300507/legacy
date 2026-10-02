import { Vector3 } from 'three';
import { buildIndex, childrenOf, parentsOf, partnersOf, type GraphIndex } from './graph';
import type { Person, Relationship } from './types';

export const GEN_GAP = 4;
export const NODE_W = 2.8;
const TREE_GAP = 4;
const ARC_RADIUS = 3;
const ARC_SPREAD = (2 * Math.PI) / 3;
const STUB_Z = 3;

/** Generation per person: children below parents, partners level. Relaxed to a fixpoint. */
export function computeGenerations(people: Person[], rels: Relationship[]): Map<string, number> {
  const gen = new Map(people.map((p) => [p.id, 0]));
  const has = (id: string) => gen.has(id);
  const parentRels = rels.filter((r) => r.type === 'parent' && has(r.parent) && has(r.child)) as Extract<Relationship, { type: 'parent' }>[];
  const partnerRels = rels.filter((r) => r.type === 'partner' && has(r.a) && has(r.b)) as Extract<Relationship, { type: 'partner' }>[];
  // Bounded: a malformed graph (someone partnered with their own child) must not loop forever.
  for (let iter = 0; iter < people.length * 2 + 5; iter++) {
    let changed = false;
    const raise = (id: string, v: number) => {
      if (gen.get(id)! < v) {
        gen.set(id, v);
        changed = true;
      }
    };
    for (const r of parentRels) raise(r.child, gen.get(r.parent)! + 1);
    for (const r of partnerRels) {
      const m = Math.max(gen.get(r.a)!, gen.get(r.b)!);
      raise(r.a, m);
      raise(r.b, m);
    }
    // Pull childless-root ancestors (e.g. an in-law's parents) down next to their child.
    for (const r of parentRels) raise(r.parent, gen.get(r.child)! - 1);
    if (!changed) break;
  }
  const min = Math.min(...gen.values());
  for (const [id, g] of gen) gen.set(id, g - min);
  return gen;
}

type Cluster = {
  members: string[];
  gen: number;
  children: Cluster[];
  width: number;
  x: number;
  z: number;
  claimed: boolean;
};

function orderMembers(ix: GraphIndex, ids: string[], hub: string): string[] {
  // Hub in the middle, partners alternating left / right in insertion order.
  const inCluster = new Set(ids);
  const order = [hub];
  const seen = new Set([hub]);
  const queue = [hub];
  let left = true;
  while (queue.length) {
    const cur = queue.shift()!;
    for (const p of partnersOf(ix, cur)) {
      if (!inCluster.has(p) || seen.has(p)) continue;
      seen.add(p);
      queue.push(p);
      if (left) order.unshift(p);
      else order.push(p);
      left = !left;
    }
  }
  return order;
}

export function computeLayout(people: Person[], rels: Relationship[]): Map<string, Vector3> {
  const out = new Map<string, Vector3>();
  if (people.length === 0) return out;
  const ix = buildIndex(people, rels);
  const gen = computeGenerations(people, rels);
  const order = new Map(people.map((p, i) => [p.id, i]));
  const birth = new Map(people.map((p) => [p.id, p.birthYear ?? Infinity]));

  // Partner-connected groups on the same generation form one cluster.
  const clusterOf = new Map<string, Cluster>();
  const clusters: Cluster[] = [];
  for (const p of people) {
    if (clusterOf.has(p.id)) continue;
    const ids: string[] = [];
    const stack = [p.id];
    const seen = new Set(stack);
    while (stack.length) {
      const cur = stack.pop()!;
      ids.push(cur);
      for (const q of partnersOf(ix, cur))
        if (!seen.has(q) && gen.get(q) === gen.get(cur)) {
          seen.add(q);
          stack.push(q);
        }
    }
    ids.sort((a, b) => order.get(a)! - order.get(b)!);
    const c: Cluster = { members: ids, gen: gen.get(p.id)!, children: [], width: 0, x: 0, z: 0, claimed: false };
    for (const id of ids) clusterOf.set(id, c);
    clusters.push(c);
  }

  const hubOf = (c: Cluster, preferred?: string) =>
    preferred ?? c.members.reduce((best, id) => (partnersOf(ix, id).length > partnersOf(ix, best).length ? id : best));

  const descendants = (c: Cluster) => {
    const seen = new Set<string>();
    const stack = [...c.members];
    while (stack.length) {
      const id = stack.pop()!;
      for (const ch of childrenOf(ix, id)) if (!seen.has(ch)) { seen.add(ch); stack.push(ch); }
    }
    return seen.size;
  };

  const roots = clusters
    .filter((c) => c.members.every((id) => parentsOf(ix, id).length === 0))
    .sort((a, b) => descendants(b) - descendants(a));

  // Each cluster hangs under exactly one parent cluster (the first to claim it).
  const claim = (c: Cluster, hub?: string) => {
    c.claimed = true;
    c.members = orderMembers(ix, c.members, hubOf(c, hub));
    const kids: string[] = [];
    for (const m of c.members) {
      const own = [...childrenOf(ix, m)].sort((a, b) => birth.get(a)! - birth.get(b)! || order.get(a)! - order.get(b)!);
      for (const k of own) if (!kids.includes(k)) kids.push(k);
    }
    for (const k of kids) {
      const kc = clusterOf.get(k)!;
      if (kc.claimed || kc.gen <= c.gen) continue;
      c.children.push(kc);
      claim(kc, k);
    }
  };
  for (const r of roots) if (!r.claimed) claim(r);
  for (const c of clusters) if (!c.claimed) claim(c); // safety for malformed graphs

  const measure = (c: Cluster): number => {
    const childW = c.children.reduce((s, ch) => s + measure(ch), 0);
    c.width = Math.max(c.members.length * NODE_W, childW);
    return c.width;
  };

  const place = (c: Cluster, left: number, z: number) => {
    c.x = left + c.width / 2;
    c.z = z;
    const total = c.children.reduce((s, ch) => s + ch.width, 0);
    let cursor = c.x - total / 2;
    const k = c.children.length;
    c.children.forEach((ch, i) => {
      // Sibling branches fan out on an arc in depth around the parent.
      const theta = k > 1 ? (i / (k - 1) - 0.5) * ARC_SPREAD : 0;
      place(ch, cursor, z - ARC_RADIUS * (1 - Math.cos(theta)) + (k > 1 ? Math.sin(theta) * 0.8 : 0));
      cursor += ch.width;
    });
  };

  // Root clusters with children but nothing claimed (e.g. an in-law's parents) sit above their child.
  const isStub = (c: Cluster) => c.children.length === 0 && c.members.some((id) => childrenOf(ix, id).length > 0);
  const trees = roots.filter((r) => !isStub(r));
  const stubs = roots.filter(isStub);

  let cursor = 0;
  for (const t of trees) {
    measure(t);
    place(t, cursor, 0);
    cursor += t.width + TREE_GAP;
  }

  const maxGen = Math.max(...gen.values());
  const yOf = (g: number) => (maxGen / 2 - g) * GEN_GAP;
  const emit = (c: Cluster) => {
    c.members.forEach((id, j) => out.set(id, new Vector3(c.x + (j - (c.members.length - 1) / 2) * NODE_W, yOf(c.gen), c.z)));
    c.children.forEach(emit);
  };
  trees.forEach(emit);

  for (const s of stubs) {
    const kids = s.members.flatMap((id) => childrenOf(ix, id)).map((id) => out.get(id)).filter((v): v is Vector3 => !!v);
    const cx = kids.length ? kids.reduce((a, v) => a + v.x, 0) / kids.length : cursor;
    const cz = kids.length ? Math.min(...kids.map((v) => v.z)) - STUB_Z : 0;
    const y = yOf(s.gen);
    const collides = (x: number) =>
      [...out.values()].some((v) => Math.abs(v.y - y) < 0.01 && Math.abs(v.z - cz) < 1.5 && Math.abs(v.x - x) < NODE_W * (s.members.length + 1) / 2);
    let x = cx;
    for (let step = 1; collides(x); step++) x = cx + (step % 2 ? 1 : -1) * Math.ceil(step / 2) * NODE_W;
    s.x = x;
    s.z = cz;
    emit(s);
  }

  // Center the whole forest around the origin.
  const xs = [...out.values()].map((v) => v.x);
  const zs = [...out.values()].map((v) => v.z);
  const dx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const dz = (Math.min(...zs) + Math.max(...zs)) / 2;
  for (const v of out.values()) {
    v.x -= dx;
    v.z -= dz;
  }
  return out;
}
