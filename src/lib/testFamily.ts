import type { Gender, Person, Relationship } from './types';

/** Build a family from compact notation; ids are the names. Test helper. */
export function makeFamily(spec: {
  people: Record<string, Gender | undefined>;
  partners?: [string, string][];
  parents?: Record<string, string[]>;
}): { people: Person[]; relationships: Relationship[] } {
  const people: Person[] = Object.entries(spec.people).map(([name, gender]) => ({ id: name, name, gender }));
  const relationships: Relationship[] = [];
  let n = 0;
  for (const [a, b] of spec.partners ?? []) relationships.push({ id: `r${n++}`, type: 'partner', a, b });
  for (const [child, parents] of Object.entries(spec.parents ?? {}))
    for (const parent of parents) relationships.push({ id: `r${n++}`, type: 'parent', parent, child });
  return { people, relationships };
}

/**
 * Hayes family used across tests:
 *  Robert+Eleanor -> Thomas, George, Anna
 *  Thomas+Linda -> Justin, Sara ; Thomas+Rita (remarriage) -> Max ; Rita -> Ella (prior)
 *  Linda's father Walter. George+Helen -> Maria. Anna -> Alex (gender unknown)
 *  Justin+Kate -> Leo -> Noah ; Kate's mother Kim -> Kate, Ben
 *  Maria -> Mia -> Zoe ; Ursula unrelated
 */
export const hayes = () =>
  makeFamily({
    people: {
      Robert: 'male', Eleanor: 'female', Thomas: 'male', George: 'male', Anna: 'female',
      Linda: 'female', Rita: 'female', Ella: 'female', Walter: 'male', Helen: 'female',
      Justin: 'male', Sara: 'female', Max: 'male', Maria: 'female', Alex: undefined,
      Kate: 'female', Kim: 'female', Ben: 'male', Leo: 'male', Noah: 'male',
      Mia: 'female', Zoe: 'female', Ursula: 'female',
    },
    partners: [['Robert', 'Eleanor'], ['Thomas', 'Linda'], ['Thomas', 'Rita'], ['George', 'Helen'], ['Justin', 'Kate']],
    parents: {
      Thomas: ['Robert', 'Eleanor'], George: ['Robert', 'Eleanor'], Anna: ['Robert', 'Eleanor'],
      Linda: ['Walter'], Justin: ['Thomas', 'Linda'], Sara: ['Thomas', 'Linda'], Max: ['Thomas', 'Rita'],
      Ella: ['Rita'], Maria: ['George', 'Helen'], Alex: ['Anna'], Kate: ['Kim'], Ben: ['Kim'],
      Leo: ['Justin', 'Kate'], Noah: ['Leo'], Mia: ['Maria'], Zoe: ['Mia'],
    },
  });
