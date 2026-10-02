import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { bend, computeFlatLayout, computeGenerations, computeLayout, GEN_GAP, NODE_W } from './layout';
import { hayes, makeFamily } from './testFamily';
import type { Person, Relationship } from './types';

const f = hayes();
const pos = computeFlatLayout(f.people, f.relationships);
const at = (id: string) => pos.get(id)!;

describe('computeGenerations', () => {
  it('levels partners and places children one below', () => {
    const g = computeGenerations(f.people, f.relationships);
    expect(g.get('Robert')).toBe(0);
    expect(g.get('Thomas')).toBe(1);
    expect(g.get('Linda')).toBe(1);
    expect(g.get('Kate')).toBe(2);
    expect(g.get('Kim')).toBe(1); // in-law parent pulled down next to her child
    expect(g.get('Noah')).toBe(4);
  });
});

describe('computeLayout', () => {
  it('positions everyone', () => {
    expect(pos.size).toBe(f.people.length);
  });

  it('puts older generations higher, GEN_GAP apart', () => {
    expect(at('Robert').y - at('Thomas').y).toBeCloseTo(GEN_GAP);
    expect(at('Thomas').y - at('Justin').y).toBeCloseTo(GEN_GAP);
    expect(at('Justin').y).toBeGreaterThan(at('Leo').y);
  });

  it('puts partners side by side on the same level and depth', () => {
    for (const [a, b] of [['Robert', 'Eleanor'], ['George', 'Helen'], ['Justin', 'Kate']]) {
      expect(at(a).y).toBeCloseTo(at(b).y);
      expect(at(a).z).toBeCloseTo(at(b).z);
      expect(Math.abs(at(a).x - at(b).x)).toBeCloseTo(NODE_W);
    }
  });

  it('places the remarried person between both partners', () => {
    const xs = ['Linda', 'Thomas', 'Rita'].map((id) => at(id).x).sort((a, b) => a - b);
    expect(at('Thomas').x).toBeCloseTo(xs[1]);
  });

  it('centres children under their parents’ midpoint', () => {
    const fam = makeFamily({
      people: { A: 'male', B: 'female', C: 'male', D: 'female', E: 'male' },
      partners: [['A', 'B']],
      parents: { C: ['A', 'B'], D: ['A', 'B'], E: ['A', 'B'] },
    });
    const p = computeFlatLayout(fam.people, fam.relationships);
    const mid = (p.get('A')!.x + p.get('B')!.x) / 2;
    const meanKids = (p.get('C')!.x + p.get('D')!.x + p.get('E')!.x) / 3;
    expect(meanKids).toBeCloseTo(mid);
    expect(p.get('D')!.x).toBeCloseTo(mid);
  });

  it('spreads sibling branches in depth', () => {
    expect(at('Thomas').z).not.toBeCloseTo(at('George').z);
  });

  it('places an in-law’s family behind the in-law instead of off to the side', () => {
    // Kim is Kate's mother; Kate hangs under the Hayes family.
    expect(Math.abs(at('Kim').x - at('Kate').x)).toBeLessThan(NODE_W * 1.5);
    expect(at('Kim').z).toBeLessThan(at('Kate').z - 1);
    expect(Math.abs(at('Walter').x - at('Linda').x)).toBeLessThan(NODE_W * 1.5);
  });

  it('bends onto a curve while keeping partner spacing and levels', () => {
    const bent = computeLayout(f.people, f.relationships);
    for (const [a, b] of [['Robert', 'Eleanor'], ['Justin', 'Kate']]) {
      expect(bent.get(a)!.distanceTo(bent.get(b)!)).toBeCloseTo(NODE_W, 1);
      expect(bent.get(a)!.y).toBeCloseTo(bent.get(b)!.y);
    }
  });

  it('curves a flat row toward the viewer, symmetric about the centre', () => {
    const row = new Map([-30, 0, 30].map((x) => [`n${x}`, new Vector3(x, 0, 0)]));
    const b = bend(row);
    expect(b.get('n-30')!.z).toBeGreaterThan(b.get('n0')!.z + 5);
    expect(b.get('n-30')!.z).toBeCloseTo(b.get('n30')!.z);
    expect(b.get('n0')!.x).toBeCloseTo(0);
  });

  it('separates disconnected people', () => {
    const others = f.people.filter((p) => p.id !== 'Ursula').map((p) => at(p.id));
    for (const v of others) expect(v.distanceTo(at('Ursula'))).toBeGreaterThan(NODE_W * 0.9);
  });

  it('never stacks two people on the same spot in a large tree', () => {
    const people: Person[] = [];
    const rels: Relationship[] = [];
    let n = 0;
    const add = (gender: 'male' | 'female') => {
      const id = `p${n++}`;
      people.push({ id, name: id, gender });
      return id;
    };
    // 5 generations, every couple has 4 children, every child but the youngest generation marries an outsider.
    let couples: [string, string][] = [[add('male'), add('female')]];
    for (let g = 0; g < 4; g++) {
      const next: [string, string][] = [];
      for (const [a, b] of couples) {
        rels.push({ id: `r${n++}`, type: 'partner', a, b });
        for (let k = 0; k < 4; k++) {
          const c = add(k % 2 ? 'female' : 'male');
          rels.push({ id: `r${n++}`, type: 'parent', parent: a, child: c }, { id: `r${n++}`, type: 'parent', parent: b, child: c });
          if (g < 3) next.push([c, add(k % 2 ? 'male' : 'female')]);
        }
      }
      couples = next;
    }
    expect(people.length).toBeGreaterThan(200);
    const p = computeLayout(people, rels);
    const vs = [...p.values()];
    expect(vs).toHaveLength(people.length);
    let min = Infinity;
    for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) min = Math.min(min, vs[i].distanceTo(vs[j]));
    expect(min).toBeGreaterThan(1.5);
  });
});
