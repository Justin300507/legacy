import { create } from 'zustand';
import { db } from '../lib/db';
import { buildIndex, type GraphIndex } from '../lib/graph';
import type { Person, Relationship } from '../lib/types';

type FamilyState = {
  people: Person[];
  relationships: Relationship[];
  index: GraphIndex;
  byId: Map<string, Person>;
  loaded: boolean;
  load: () => Promise<void>;
  add: (people: Person[], relationships: Relationship[]) => Promise<void>;
  update: (person: Person) => Promise<void>;
  remove: (id: string) => Promise<void>;
  unlink: (relationshipId: string) => Promise<void>;
  replaceAll: (people: Person[], relationships: Relationship[]) => Promise<void>;
};

const derive = (people: Person[], relationships: Relationship[]) => ({
  people,
  relationships,
  index: buildIndex(people, relationships),
  byId: new Map(people.map((p) => [p.id, p])),
});

const involves = (r: Relationship, id: string) => (r.type === 'parent' ? r.parent === id || r.child === id : r.a === id || r.b === id);

export const useFamily = create<FamilyState>((set, get) => ({
  ...derive([], []),
  loaded: false,

  async load() {
    const [people, relationships] = await Promise.all([db.people.toArray(), db.relationships.toArray()]);
    set({ ...derive(people, relationships), loaded: true });
  },

  async add(people, relationships) {
    await db.transaction('rw', db.people, db.relationships, async () => {
      await db.people.bulkPut(people);
      await db.relationships.bulkPut(relationships);
    });
    const s = get();
    set(derive([...s.people, ...people], [...s.relationships, ...relationships]));
  },

  async update(person) {
    await db.people.put(person);
    const s = get();
    set(derive(s.people.map((p) => (p.id === person.id ? person : p)), s.relationships));
  },

  async remove(id) {
    const s = get();
    const relIds = s.relationships.filter((r) => involves(r, id)).map((r) => r.id);
    await db.transaction('rw', db.people, db.relationships, async () => {
      await db.people.delete(id);
      await db.relationships.bulkDelete(relIds);
    });
    set(derive(s.people.filter((p) => p.id !== id), s.relationships.filter((r) => !involves(r, id))));
  },

  async unlink(relationshipId) {
    await db.relationships.delete(relationshipId);
    const s = get();
    set(derive(s.people, s.relationships.filter((r) => r.id !== relationshipId)));
  },

  async replaceAll(people, relationships) {
    await db.transaction('rw', db.people, db.relationships, async () => {
      await db.people.clear();
      await db.relationships.clear();
      await db.people.bulkPut(people);
      await db.relationships.bulkPut(relationships);
    });
    set(derive(people, relationships));
  },
}));
