import Dexie, { type Table } from 'dexie';
import type { Person, Relationship } from './types';

class FamilyDB extends Dexie {
  declare people: Table<Person, string>;
  declare relationships: Table<Relationship, string>;

  constructor() {
    super('family-tree-3d');
    this.version(1).stores({ people: 'id', relationships: 'id' });
  }
}

export const db = new FamilyDB();
