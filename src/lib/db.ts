import Dexie, { type Table } from 'dexie';
import type { Person, Relationship } from './types';

class FamilyDB extends Dexie {
  declare people: Table<Person, string>;
  declare relationships: Table<Relationship, string>;
  declare settings: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super('family-tree-3d');
    this.version(1).stores({ people: 'id', relationships: 'id' });
    this.version(2).stores({ people: 'id', relationships: 'id', settings: 'key' });
  }
}

export const db = new FamilyDB();

export async function getSetting<T>(key: string): Promise<T | undefined> {
  return (await db.settings.get(key))?.value as T | undefined;
}

export async function setSetting(key: string, value: unknown) {
  if (value === undefined) await db.settings.delete(key);
  else await db.settings.put({ key, value });
}
