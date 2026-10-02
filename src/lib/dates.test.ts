import { describe, expect, it } from 'vitest';
import { familyDates, formatDate, isValidDate, nextOccurrence, upcomingDates } from './dates';
import type { Person, Relationship } from './types';

const people: Person[] = [
  { id: 'a', name: 'Eric', birthDate: '1990-03-03' },
  { id: 'b', name: 'Saby', birthDate: '1965-12-31', deathDate: '2020-06-15' },
  { id: 'c', name: 'Leap', birthDate: '2000-02-29' },
  { id: 'd', name: 'NoDates', birthYear: 1950 },
];
const rels: Relationship[] = [
  { id: 'r1', type: 'partner', a: 'a', b: 'b', weddingDate: '2015-06-20' },
  { id: 'r2', type: 'partner', a: 'c', b: 'd' },
  { id: 'r3', type: 'parent', parent: 'b', child: 'a' },
];

describe('isValidDate', () => {
  it('accepts real calendar dates only', () => {
    expect(isValidDate('2024-02-29')).toBe(true);
    expect(isValidDate('2023-02-29')).toBe(false);
    expect(isValidDate('2023-13-01')).toBe(false);
    expect(isValidDate('3/3/1990')).toBe(false);
    expect(isValidDate(undefined)).toBe(false);
  });
});

describe('familyDates', () => {
  const dates = familyDates(people, rels);
  const byKey = new Map(dates.map((d) => [d.key, d]));

  it('derives birthdays, remembrance days and wedding anniversaries', () => {
    expect([...byKey.keys()].sort()).toEqual(['birth:a', 'birth:b', 'birth:c', 'death:b', 'wedding:r1']);
    expect(byKey.get('birth:a')!.title).toBe("Eric's birthday");
    expect(byKey.get('death:b')!.title).toBe('Remembering Saby');
    expect(byKey.get('wedding:r1')!.title).toBe("Eric & Saby's wedding anniversary");
    expect(byKey.get('wedding:r1')!.people).toEqual(['a', 'b']);
  });

  it('formats dates readably', () => {
    expect(formatDate('1990-03-03')).toBe('3 Mar 1990');
    expect(formatDate('1990-03-03', false)).toBe('3 Mar');
  });
});

describe('upcoming', () => {
  const from = new Date(2026, 5, 10); // 10 Jun 2026

  it('finds the next occurrence, rolling into next year', () => {
    expect(nextOccurrence('1990-03-03', from)).toEqual(new Date(2027, 2, 3));
    expect(nextOccurrence('2015-06-20', from)).toEqual(new Date(2026, 5, 20));
    expect(nextOccurrence('2015-06-10', from)).toEqual(new Date(2026, 5, 10)); // today counts
  });

  it('puts Feb 29 on Feb 28 in non-leap years', () => {
    expect(nextOccurrence('2000-02-29', new Date(2027, 0, 1))).toEqual(new Date(2027, 1, 28));
    expect(nextOccurrence('2000-02-29', new Date(2028, 0, 1))).toEqual(new Date(2028, 1, 29));
  });

  it('lists soonest first with the anniversary number', () => {
    const list = upcomingDates(familyDates(people, rels), from, 30);
    expect(list.map((u) => [u.key, u.inDays, u.years])).toEqual([
      ['death:b', 5, 6],
      ['wedding:r1', 10, 11],
    ]);
  });
});
