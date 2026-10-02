import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../lib/db';
import { demoFamily } from '../lib/demo';
import { useFamily } from './family';

describe('family store', () => {
  beforeEach(async () => {
    await useFamily.getState().replaceAll([], []);
  });

  it('persists additions and reloads them', async () => {
    const demo = demoFamily();
    await useFamily.getState().add(demo.people, demo.relationships);
    await useFamily.getState().load();
    expect(useFamily.getState().people).toHaveLength(15);
    expect(useFamily.getState().people.map((p) => p.id)).toEqual(demo.people.map((p) => p.id));
    expect(await db.relationships.count()).toBe(demo.relationships.length);
  });

  it('deletes a person together with their relationships', async () => {
    const demo = demoFamily();
    await useFamily.getState().replaceAll(demo.people, demo.relationships);
    const thomas = demo.people.find((p) => p.name === 'Thomas Hayes')!;
    await useFamily.getState().remove(thomas.id);
    const s = useFamily.getState();
    expect(s.byId.has(thomas.id)).toBe(false);
    const dangling = s.relationships.filter((r) => (r.type === 'parent' ? [r.parent, r.child] : [r.a, r.b]).includes(thomas.id));
    expect(dangling).toEqual([]);
    expect(await db.relationships.count()).toBe(s.relationships.length);
  });
});
