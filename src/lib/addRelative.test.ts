import { describe, expect, it } from 'vitest';
import { canAdd, lineAnchorIds, planAddition, PLACEHOLDER_NAME } from './addRelative';
import { buildIndex } from './graph';
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

describe('canAdd', () => {
  it('prevents a third parent', () => {
    expect(canAdd(ix, 'Justin', 'parent')).toBe(false);
    expect(canAdd(ix, 'Kate', 'parent')).toBe(true);
  });
});
