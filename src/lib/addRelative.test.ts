import { describe, expect, it } from 'vitest';
import { canAdd, lineAnchorIds, parentCandidates, planAddition, PLACEHOLDER_NAME, singleParentChildren, suggestedParents } from './addRelative';
import { buildIndex, findPath } from './graph';
import { relationshipLabel } from './relationship';
import { hayes } from './testFamily';
import type { Relationship } from './types';

const f = hayes();
const ix = buildIndex(f.people, f.relationships);
const none = { otherParent: null, placeholderId: null };
const newbie = { id: 'new', name: 'New' };
const strip = (rels: Relationship[]) => rels.map(({ id: _id, ...r }) => r);

describe('planAddition', () => {
  it('adds a child with both parents', () => {
    const plan = planAddition(ix, 'Justin', 'child', newbie, { ...none, otherParent: 'Kate' });
    expect(strip(plan.relationships)).toEqual([
      { type: 'parent', parent: 'Justin', child: 'new' },
      { type: 'parent', parent: 'Kate', child: 'new' },
    ]);
  });

  it('adds a sibling under the same parents', () => {
    const plan = planAddition(ix, 'Justin', 'sibling', newbie, none);
    expect(strip(plan.relationships)).toEqual([
      { type: 'parent', parent: 'Thomas', child: 'new' },
      { type: 'parent', parent: 'Linda', child: 'new' },
    ]);
  });

  it('creates a placeholder parent for a sibling of a root', () => {
    const plan = planAddition(ix, 'Kim', 'sibling', newbie, { ...none, placeholderId: 'ph' });
    expect(plan.people.map((p) => p.name)).toEqual([PLACEHOLDER_NAME, 'New']);
    expect(strip(plan.relationships)).toEqual([
      { type: 'parent', parent: 'ph', child: 'Kim' },
      { type: 'parent', parent: 'ph', child: 'new' },
    ]);
  });

  it('adds partners and parents', () => {
    expect(strip(planAddition(ix, 'Sara', 'partner', newbie, none).relationships)).toEqual([{ type: 'partner', a: 'Sara', b: 'new' }]);
    expect(strip(planAddition(ix, 'Kate', 'parent', newbie, none).relationships)).toEqual([{ type: 'parent', parent: 'new', child: 'Kate' }]);
  });
});

describe('lineAnchorIds', () => {
  it('starts a child line at the couple midpoint', () => {
    expect(lineAnchorIds(ix, 'Justin', 'child', { ...none, otherParent: 'Kate' })).toEqual(['Justin', 'Kate']);
    expect(lineAnchorIds(ix, 'Justin', 'child', none)).toEqual(['Justin']);
  });

  it('starts a sibling line at the parents', () => {
    expect(lineAnchorIds(ix, 'Justin', 'sibling', none)).toEqual(['Thomas', 'Linda']);
    expect(lineAnchorIds(ix, 'Kim', 'sibling', { ...none, placeholderId: 'ph' })).toEqual(['ph']);
  });
});

describe('partner added after the children (reported bug)', () => {
  // Maria has Mia with no other parent recorded; then Maria gets a partner.
  const plan = (coParentOf?: string[]) =>
    planAddition(ix, 'Maria', 'partner', { id: 'Paul', name: 'Paul', gender: 'male' }, { ...none, coParentOf });
  const withPaul = (coParentOf?: string[]) => {
    const p = plan(coParentOf);
    const people = [...f.people, ...p.people];
    const g = buildIndex(people, [...f.relationships, ...p.relationships]);
    const genders = new Map(people.map((x) => [x.id, x.gender]));
    return (a: string, b: string) => relationshipLabel(findPath(g, a, b)!, g, (id) => genders.get(id));
  };

  it('offers the single-parent children as co-parent candidates', () => {
    expect(singleParentChildren(ix, 'Maria')).toEqual(['Mia']);
    expect(singleParentChildren(ix, 'Justin')).toEqual([]); // Leo already has both parents
  });

  it('makes the partner a parent of the chosen children: daughter, not step-daughter', () => {
    const rel = withPaul(['Mia']);
    expect(rel('Paul', 'Mia')).toBe('daughter');
    expect(rel('Mia', 'Paul')).toBe('father');
    expect(rel('Zoe', 'Paul')).toBe('grandfather');
  });

  it('keeps step-relations when the partner is not a parent', () => {
    expect(withPaul([])('Paul', 'Mia')).toBe('step-daughter');
  });
});

describe('linking an existing parent', () => {
  it('suggests the existing parent’s partner', () => {
    expect(suggestedParents(ix, 'Ella')).toEqual(['Thomas']); // Rita's daughter; Rita is partnered with Thomas
    expect(suggestedParents(ix, 'Justin')).toEqual([]); // already has two parents
  });

  it('never offers the child, a current parent, or a descendant', () => {
    const c = parentCandidates(ix, 'Mia');
    expect(c).not.toContain('Mia');
    expect(c).not.toContain('Maria');
    expect(c).not.toContain('Zoe');
    expect(c).toContain('Ben');
    expect(parentCandidates(ix, 'Justin')).toEqual([]);
  });
});

describe('canAdd', () => {
  it('prevents a third parent', () => {
    expect(canAdd(ix, 'Justin', 'parent')).toBe(false);
    expect(canAdd(ix, 'Kate', 'parent')).toBe(true);
  });
});
