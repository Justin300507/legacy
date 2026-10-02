import { newId } from './id';
import type { Gender, Person, Relationship } from './types';

type Row = [key: string, name: string, gender: Gender, birthYear: number, notes?: string];

const PEOPLE: Row[] = [
  ['robert', 'Robert Hayes', 'male', 1938, 'Carpenter. Built the family house by the lake.'],
  ['eleanor', 'Eleanor Hayes', 'female', 1941, 'Schoolteacher for 35 years.'],
  ['thomas', 'Thomas Hayes', 'male', 1962],
  ['linda', 'Linda Moore', 'female', 1963, "Thomas's first wife."],
  ['rita', 'Rita Alvarez', 'female', 1970, 'Married Thomas in 2001.'],
  ['george', 'George Hayes', 'male', 1965],
  ['helen', 'Helen Hayes', 'female', 1966],
  ['anna', 'Anna Hayes', 'female', 1968, 'Lives in Lisbon.'],
  ['justin', 'Justin Hayes', 'male', 1990],
  ['kate', 'Kate Hayes', 'female', 1991],
  ['sara', 'Sara Hayes', 'female', 1993],
  ['max', 'Max Hayes', 'male', 2003],
  ['maria', 'Maria Hayes', 'female', 1992],
  ['noah', 'Noah Hayes', 'male', 2018],
  ['lily', 'Lily Hayes', 'female', 2020],
];

const PARTNERS: [string, string][] = [
  ['robert', 'eleanor'],
  ['thomas', 'linda'],
  ['thomas', 'rita'],
  ['george', 'helen'],
  ['justin', 'kate'],
];

const PARENTS: [child: string, parents: string[]][] = [
  ['thomas', ['robert', 'eleanor']],
  ['george', ['robert', 'eleanor']],
  ['anna', ['robert', 'eleanor']],
  ['justin', ['thomas', 'linda']],
  ['sara', ['thomas', 'linda']],
  ['max', ['thomas', 'rita']],
  ['maria', ['george', 'helen']],
  ['noah', ['justin', 'kate']],
  ['lily', ['maria']],
];

/** 15 people over 4 generations, with a remarriage, half-siblings, cousins and second cousins. */
export function demoFamily(): { people: Person[]; relationships: Relationship[] } {
  const ids = new Map(PEOPLE.map(([key]) => [key, newId()]));
  const id = (k: string) => ids.get(k)!;
  const people = PEOPLE.map(([key, name, gender, birthYear, notes]): Person => ({ id: id(key), name, gender, birthYear, notes }));
  const relationships: Relationship[] = [
    ...PARTNERS.map(([a, b]): Relationship => ({ id: newId(), type: 'partner', a: id(a), b: id(b) })),
    ...PARENTS.flatMap(([child, parents]) =>
      parents.map((p): Relationship => ({ id: newId(), type: 'parent', parent: id(p), child: id(child) })),
    ),
  ];
  return { people, relationships };
}
