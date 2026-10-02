import { describe, expect, it } from 'vitest';
import { buildIndex, findPath } from './graph';
import { bloodTerm, describeConnection, plainLabel, relationshipLabel } from './relationship';
import { hayes, makeFamily } from './testFamily';

const f = hayes();
const ix = buildIndex(f.people, f.relationships);
const people = new Map(f.people.map((p) => [p.id, p]));
const genderOf = (id: string) => people.get(id)?.gender;

/** What `b` is to `a`. */
const rel = (a: string, b: string) => {
  const path = findPath(ix, a, b);
  return path ? relationshipLabel(path, ix, genderOf) : null;
};

describe('relationshipLabel — direct line', () => {
  it.each([
    ['Justin', 'Thomas', 'father'],
    ['Justin', 'Linda', 'mother'],
    ['Thomas', 'Justin', 'son'],
    ['Thomas', 'Sara', 'daughter'],
    ['Justin', 'Robert', 'grandfather'],
    ['Justin', 'Walter', 'grandfather'],
    ['Leo', 'Eleanor', 'great-grandmother'],
    ['Noah', 'Robert', 'great-great-grandfather'],
    ['Robert', 'Leo', 'great-grandson'],
    ['Eleanor', 'Justin', 'grandson'],
  ])('%s → %s is %s', (a, b, expected) => expect(rel(a, b)).toBe(expected));
});

describe('relationshipLabel — collateral', () => {
  it.each([
    ['Sara', 'Justin', 'brother'],
    ['Justin', 'Sara', 'sister'],
    ['Justin', 'Max', 'half-brother'],
    ['Max', 'Sara', 'half-sister'],
    ['Justin', 'George', 'uncle'],
    ['Justin', 'Anna', 'aunt'],
    ['Leo', 'George', 'grand-uncle'], // grandparents' generation is 'grand'
    ['Leo', 'Anna', 'grand-aunt'],
    ['Noah', 'George', 'great-grand-uncle'], // one more generation adds 'great'
    ['George', 'Leo', 'grand-nephew'],
    ['George', 'Noah', 'great-grand-nephew'],
    ['Anna', 'Leo', 'grand-nephew'],
    ['George', 'Justin', 'nephew'],
    ['George', 'Sara', 'niece'],
    ['Thomas', 'Alex', 'niece/nephew'],
    ['Justin', 'Maria', 'first cousin'],
    ['Justin', 'Alex', 'first cousin'],
    ['Leo', 'Maria', 'first cousin once removed'],
    ['Maria', 'Leo', 'first cousin once removed'],
    ['Leo', 'Mia', 'second cousin'],
    ['Noah', 'Mia', 'second cousin once removed'],
    ['Noah', 'Maria', 'first cousin twice removed'],
    ['Noah', 'Zoe', 'third cousin'],
  ])('%s → %s is %s', (a, b, expected) => expect(rel(a, b)).toBe(expected));
});

describe('relationshipLabel — partners, in-laws and steps', () => {
  it.each([
    ['Justin', 'Kate', 'wife'],
    ['Kate', 'Justin', 'husband'],
    ['Kate', 'Thomas', 'father-in-law'],
    ['Kate', 'Linda', 'mother-in-law'],
    ['Kate', 'Robert', 'grandfather-in-law'],
    ['Justin', 'Ben', 'brother-in-law'],
    ['Kate', 'Sara', 'sister-in-law'],
    ['Sara', 'Kate', 'sister-in-law'],
    ['Ben', 'Justin', 'brother-in-law'],
    ['Linda', 'Kate', 'daughter-in-law'],
    ['Kim', 'Justin', 'son-in-law'],
    ['Justin', 'Rita', 'step-mother'],
    ['Rita', 'Justin', 'step-son'],
    ['Rita', 'Sara', 'step-daughter'],
    ['Justin', 'Ella', 'step-sister'],
    ['Ella', 'Thomas', 'step-father'],
    ['Linda', 'Rita', 'relative by marriage'],
  ])('%s → %s is %s', (a, b, expected) => expect(rel(a, b)).toBe(expected));

  it('describes a person relative to themselves as self', () => {
    expect(rel('Justin', 'Justin')).toBe('self');
  });

  it('has no relationship for unconnected people', () => {
    expect(rel('Justin', 'Ursula')).toBeNull();
  });
});

describe('bloodTerm', () => {
  it('uses neutral wording when gender is unknown', () => {
    expect(bloodTerm(1, 0)).toBe('parent');
    expect(bloodTerm(0, 2)).toBe('grandchild');
    expect(bloodTerm(1, 1)).toBe('sibling');
    expect(bloodTerm(2, 1)).toBe('aunt/uncle');
  });

  it('handles distant cousins', () => {
    expect(bloodTerm(4, 4, 'male')).toBe('third cousin');
    expect(bloodTerm(3, 6, 'female')).toBe('second cousin three times removed');
  });
});

describe('describeConnection', () => {
  it('says what B is to A, and builds the step chain', () => {
    const d = describeConnection(findPath(ix, 'Justin', 'Maria')!, ix, people);
    expect(d.sentence).toBe("Maria is Justin's first cousin");
    expect(d.label).toBe('first cousin');
    expect(d.chain).toBe('Justin → father Thomas → brother George → daughter Maria');
  });

  it('keeps the formal reverse relation available', () => {
    const d = describeConnection(findPath(ix, 'Kate', 'Thomas')!, ix, people);
    expect(d.sentence).toBe("Thomas is Kate's father-in-law");
    expect(d.relation).toBe('daughter-in-law');
    expect(d.chain).toBe('Kate → husband Justin → father Thomas');
  });

  it('marks half siblings in the chain', () => {
    const d = describeConnection(findPath(ix, 'Justin', 'Max')!, ix, people);
    expect(d.chain).toBe('Justin → half-brother Max');
    expect(d.sentence).toBe("Max is Justin's half-brother");
  });
});

describe('plainLabel — everyday wording, never "removed" or "by marriage"', () => {
  const plain = (a: string, b: string) => plainLabel(findPath(ix, a, b)!, ix, genderOf);
  it.each([
    ['Leo', 'Maria', "father's first cousin"], // formally: first cousin once removed
    ['Maria', 'Leo', "first cousin's son"],
    ['Noah', 'Maria', "grandfather's first cousin"], // formally: first cousin twice removed
    ['Zoe', 'Leo', "mother's second cousin"],
    ['Zoe', 'Justin', "grandmother's first cousin"],
    ['Maria', 'Noah', "first cousin's grandson"],
    ['Noah', 'Mia', "father's second cousin"],
    ['Mia', 'Noah', "second cousin's son"],
    ['Justin', 'Maria', 'first cousin'],
    ['Leo', 'Mia', 'second cousin'],
    ['Justin', 'George', 'uncle'],
    ['Kate', 'Thomas', 'father-in-law'],
    ['Kate', 'Maria', "husband's first cousin"],
  ])('%s → %s is "%s"', (a, b, expected) => expect(plain(a, b)).toBe(expected));

  it('adds "great" for each generation above the grandparents', () => {
    const fam = makeFamily({
      people: { Root: 'male', A1: 'male', B1: 'female', A2: 'male', B2: 'male', A3: 'female', A4: 'male', Me: 'female' },
      parents: { A1: ['Root'], B1: ['Root'], A2: ['A1'], B2: ['B1'], A3: ['A2'], A4: ['A3'], Me: ['A4'] },
    });
    const g = buildIndex(fam.people, fam.relationships);
    const gen = new Map(fam.people.map((p) => [p.id, p.gender]));
    const say = (a: string, b: string) => plainLabel(findPath(g, a, b)!, g, (id) => gen.get(id));
    expect(say('Me', 'B2')).toBe("great-grandfather's first cousin"); // B2 is A2's first cousin; A2 is Me's great-grandfather
    expect(say('Me', 'B1')).toBe('great-great-grand-aunt'); // sister of Me's great-great-grandfather
    expect(say('A3', 'B1')).toBe('grand-aunt');
  });

  it('names a removed cousin’s partner through the chain (reported case)', () => {
    // Eric → mother Saby → father VJ → sister Akkuty → son Ajay → wife Jessy
    const fam = makeFamily({
      people: { Joshua: 'male', VJ: 'male', Akkuty: 'female', Saby: 'female', Eric: 'male', Ajay: 'male', Jessy: 'female' },
      partners: [['Ajay', 'Jessy']],
      parents: { VJ: ['Joshua'], Akkuty: ['Joshua'], Saby: ['VJ'], Eric: ['Saby'], Ajay: ['Akkuty'] },
    });
    const g = buildIndex(fam.people, fam.relationships);
    const gen = new Map(fam.people.map((p) => [p.id, p.gender]));
    const say = (a: string, b: string) => plainLabel(findPath(g, a, b)!, g, (id) => gen.get(id));
    expect(say('Eric', 'Jessy')).toBe("mother's first cousin's wife");
    expect(say('Eric', 'Ajay')).toBe("mother's first cousin");
    expect(say('Jessy', 'Eric')).toBe("husband's first cousin's son");
    for (const [a, b] of [['Eric', 'Jessy'], ['Jessy', 'Eric'], ['Eric', 'Ajay']]) expect(say(a, b)).not.toMatch(/removed|by marriage/);
  });
});
