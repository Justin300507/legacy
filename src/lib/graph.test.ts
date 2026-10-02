import { describe, expect, it } from 'vitest';
import { buildIndex, findPath, reversePath, siblingsOf } from './graph';
import { hayes } from './testFamily';

const f = hayes();
const ix = buildIndex(f.people, f.relationships);

describe('findPath', () => {
  it('returns empty path for the same person', () => {
    expect(findPath(ix, 'Justin', 'Justin')).toEqual([]);
  });

  it('returns null when unreachable or unknown', () => {
    expect(findPath(ix, 'Justin', 'Ursula')).toBeNull();
    expect(findPath(ix, 'Justin', 'nobody')).toBeNull();
  });

  it('tags direction on each step', () => {
    expect(findPath(ix, 'Justin', 'Thomas')).toEqual([{ from: 'Justin', to: 'Thomas', kind: 'parent' }]);
    expect(findPath(ix, 'Thomas', 'Justin')).toEqual([{ from: 'Thomas', to: 'Justin', kind: 'child' }]);
    expect(findPath(ix, 'Justin', 'Kate')).toEqual([{ from: 'Justin', to: 'Kate', kind: 'partner' }]);
  });

  it('finds the shortest path', () => {
    const p = findPath(ix, 'Justin', 'Maria')!;
    expect(p.map((s) => s.kind)).toEqual(['parent', 'parent', 'child', 'child']);
    expect(p[0].to).toBe('Thomas');
    expect(p[3].to).toBe('Maria');
  });

  it('prefers blood over partner hops at equal length', () => {
    const p = findPath(ix, 'Justin', 'Sara')!;
    expect(p.map((s) => s.kind)).toEqual(['parent', 'child']);
  });

  it('reverses paths flipping direction', () => {
    const p = findPath(ix, 'Justin', 'Maria')!;
    const r = reversePath(p);
    expect(r[0]).toEqual({ from: 'Maria', to: p[3].from, kind: 'parent' });
    expect(r.map((s) => s.kind)).toEqual(['parent', 'parent', 'child', 'child']);
  });
});

describe('siblingsOf', () => {
  it('derives full and half siblings from shared parents', () => {
    const s = siblingsOf(ix, 'Justin');
    expect(s).toContainEqual({ id: 'Sara', half: false });
    expect(s).toContainEqual({ id: 'Max', half: true });
    expect(s).toHaveLength(2);
  });
});
