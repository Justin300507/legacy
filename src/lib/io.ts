import { isValidDate } from './dates';
import type { Gender, Person, Relationship } from './types';

type ExportedPerson = Omit<Person, 'photo'> & { photo?: string };
export type ExportFile = { app: 'family-tree-3d'; version: 1; people: ExportedPerson[]; relationships: Relationship[] };

export async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(bin)}`;
}

export function dataUrlToBlob(url: string): Blob {
  const m = /^data:([^;,]*);base64,(.*)$/s.exec(url);
  if (!m) throw new Error('Invalid photo data');
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: m[1] });
}

export async function exportTree(people: Person[], relationships: Relationship[]): Promise<string> {
  const out: ExportFile = {
    app: 'family-tree-3d',
    version: 1,
    people: await Promise.all(people.map(async ({ photo, ...rest }) => (photo ? { ...rest, photo: await blobToDataUrl(photo) } : rest))),
    relationships,
  };
  return JSON.stringify(out, null, 2);
}

const GENDERS: Gender[] = ['male', 'female', 'other'];
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/** Parse and validate an exported file. Invalid relationships are dropped; invalid people throw. */
export function parseTree(json: string): { people: Person[]; relationships: Relationship[] } {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('File is not valid JSON');
  }
  const d = data as Partial<ExportFile>;
  if (!d || !Array.isArray(d.people) || !Array.isArray(d.relationships)) throw new Error('Not a family tree export');

  const people: Person[] = [];
  const ids = new Set<string>();
  for (const raw of d.people as Record<string, unknown>[]) {
    if (!raw || !isStr(raw.id) || typeof raw.name !== 'string') throw new Error('A person is missing an id or name');
    if (ids.has(raw.id)) continue;
    ids.add(raw.id);
    const p: Person = { id: raw.id, name: raw.name };
    if (GENDERS.includes(raw.gender as Gender)) p.gender = raw.gender as Gender;
    if (typeof raw.birthYear === 'number' && Number.isFinite(raw.birthYear)) p.birthYear = Math.round(raw.birthYear);
    if (isValidDate(raw.birthDate)) p.birthDate = raw.birthDate;
    if (isValidDate(raw.deathDate)) p.deathDate = raw.deathDate;
    if (typeof raw.notes === 'string') p.notes = raw.notes;
    if (typeof raw.photo === 'string') p.photo = dataUrlToBlob(raw.photo);
    people.push(p);
  }

  const relationships: Relationship[] = [];
  const relIds = new Set<string>();
  for (const r of d.relationships as Record<string, unknown>[]) {
    if (!r || !isStr(r.id) || relIds.has(r.id)) continue;
    if (r.type === 'partner' && isStr(r.a) && isStr(r.b) && ids.has(r.a) && ids.has(r.b) && r.a !== r.b)
      relationships.push({ id: r.id, type: 'partner', a: r.a, b: r.b, ...(isValidDate(r.weddingDate) ? { weddingDate: r.weddingDate } : {}) });
    else if (r.type === 'parent' && isStr(r.parent) && isStr(r.child) && ids.has(r.parent) && ids.has(r.child) && r.parent !== r.child)
      relationships.push({ id: r.id, type: 'parent', parent: r.parent, child: r.child });
    else continue;
    relIds.add(r.id);
  }
  return { people, relationships };
}
