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

// Month-day of birth for most of the family (year comes from the row); spread through the year.
const BIRTHDAYS: Record<string, string> = {
  robert: '04-12', eleanor: '10-21', thomas: '11-03', linda: '01-27', rita: '07-09', george: '10-14',
  helen: '05-30', anna: '12-08', justin: '03-03', kate: '10-29', sara: '08-17', max: '11-20',
  maria: '06-02', noah: '02-14', lily: '09-25',
};
const DEATHS: Record<string, string> = { robert: '2019-11-07' };
const WEDDINGS: Record<string, string> = {
  'robert+eleanor': '1960-10-18', 'thomas+linda': '1988-06-11', 'thomas+rita': '2001-11-24',
  'george+helen': '1990-09-08', 'justin+kate': '2016-10-22',
};

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

/** 15 people over 4 generations, with a remarriage, half-siblings, cousins, second cousins, birthdays and anniversaries. */
export function demoFamily(): { people: Person[]; relationships: Relationship[] } {
  const ids = new Map(PEOPLE.map(([key]) => [key, newId()]));
  const id = (k: string) => ids.get(k)!;
  const people = PEOPLE.map(
    ([key, name, gender, birthYear, notes]): Person => ({
      id: id(key),
      name,
      gender,
      birthYear,
      notes,
      ...(BIRTHDAYS[key] ? { birthDate: `${birthYear}-${BIRTHDAYS[key]}` } : {}),
      ...(DEATHS[key] ? { deathDate: DEATHS[key] } : {}),
    }),
  );
  const relationships: Relationship[] = [
    ...PARTNERS.map(
      ([a, b]): Relationship => ({ id: newId(), type: 'partner', a: id(a), b: id(b), ...(WEDDINGS[`${a}+${b}`] ? { weddingDate: WEDDINGS[`${a}+${b}`] } : {}) }),
    ),
    ...PARENTS.flatMap(([child, parents]) =>
      parents.map((p): Relationship => ({ id: newId(), type: 'parent', parent: id(p), child: id(child) })),
    ),
  ];
  return { people, relationships };
}
