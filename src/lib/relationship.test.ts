import { describe, expect, it } from 'vitest';
import { buildIndex, findPath } from './graph';
import { bloodTerm, describeConnection, relationshipLabel } from './relationship';
import { hayes } from './testFamily';

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
    ['Leo', 'George', 'great-uncle'],
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
  it('builds the sentence from A’s perspective and the step chain', () => {
    const d = describeConnection(findPath(ix, 'Justin', 'Maria')!, ix, people);
    expect(d.sentence).toBe("Justin is Maria's first cousin");
    expect(d.chain).toBe('Justin → father Thomas → brother George → daughter Maria');
  });

  it('uses the reverse relation for the sentence', () => {
    const d = describeConnection(findPath(ix, 'Kate', 'Thomas')!, ix, people);
    expect(d.label).toBe('father-in-law');
    expect(d.sentence).toBe("Kate is Thomas's daughter-in-law");
    expect(d.chain).toBe('Kate → husband Justin → father Thomas');
  });

  it('marks half siblings in the chain', () => {
    const d = describeConnection(findPath(ix, 'Justin', 'Max')!, ix, people);
    expect(d.chain).toBe('Justin → half-brother Max');
    expect(d.sentence).toBe("Justin is Max's half-brother");
  });
});
