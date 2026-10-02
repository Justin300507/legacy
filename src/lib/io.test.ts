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
