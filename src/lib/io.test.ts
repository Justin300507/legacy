import { describe, expect, it } from 'vitest';
import { exportTree, parseTree } from './io';
import { hayes } from './testFamily';

describe('export / import', () => {
  it('round-trips people, relationships and photos', async () => {
    const f = hayes();
    const photo = new Blob([new Uint8Array([1, 2, 3, 250, 0, 9])], { type: 'image/jpeg' });
    f.people[0] = { ...f.people[0], photo, birthYear: 1938, notes: 'Founder' };
    const back = parseTree(await exportTree(f.people, f.relationships));
    expect(back.relationships).toEqual(f.relationships);
    expect(back.people.map((p) => ({ ...p, photo: undefined }))).toEqual(f.people.map((p) => ({ ...p, photo: undefined })));
    const restored = back.people[0].photo!;
    expect(restored.type).toBe('image/jpeg');
    expect([...new Uint8Array(await restored.arrayBuffer())]).toEqual([1, 2, 3, 250, 0, 9]);
  });

  it('rejects non-tree files', () => {
    expect(() => parseTree('nope')).toThrow('not valid JSON');
    expect(() => parseTree('{"a":1}')).toThrow('Not a family tree export');
  });

  it('drops relationships pointing at unknown people', () => {
    const json = JSON.stringify({
      people: [{ id: 'a', name: 'A' }],
      relationships: [{ id: 'r1', type: 'parent', parent: 'a', child: 'ghost' }, { id: 'r2', type: 'weird' }],
    });
    expect(parseTree(json).relationships).toEqual([]);
  });
});

describe('export / import of dates', () => {
  it('keeps birthdays, death dates and wedding dates, and drops invalid ones', async () => {
    const people = [
      { id: 'a', name: 'A', birthDate: '1990-03-03', deathDate: '2020-01-01' },
      { id: 'b', name: 'B', birthDate: '1990-02-30' },
    ];
    const relationships = [{ id: 'r', type: 'partner' as const, a: 'a', b: 'b', weddingDate: '2015-06-20' }];
    const back = parseTree(await exportTree(people, relationships));
    expect(back.people[0]).toMatchObject({ birthDate: '1990-03-03', deathDate: '2020-01-01' });
    expect(back.people[1].birthDate).toBeUndefined();
    expect(back.relationships[0]).toMatchObject({ weddingDate: '2015-06-20' });
  });
});
