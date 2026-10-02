import { newId } from './id';
import { childrenOf, parentsOf, partnersOf, type GraphIndex } from './graph';
import type { Person, Relationship } from './types';

export type AddRelation = 'first' | 'parent' | 'partner' | 'child' | 'sibling';

export type AddOptions = {
  /** For a child: the other parent, or null for unknown. */
  otherParent: string | null;
  /** For a sibling of someone without parents: id to use for a placeholder parent. */
  placeholderId: string | null;
  /** For a partner: the anchor's children the new partner is also a parent of. */
  coParentOf?: string[];
  /** For a partner: wedding date (YYYY-MM-DD), stored on the partner link. */
  weddingDate?: string;
};

export const PLACEHOLDER_NAME = 'Unknown parent';

/** The people and relationships that adding `person` as `relation` of `anchor` creates. */
export function planAddition(
  ix: GraphIndex,
  anchor: string | null,
  relation: AddRelation,
  person: Person,
  opts: AddOptions,
): { people: Person[]; relationships: Relationship[] } {
  const parentRel = (parent: string, child: string): Relationship => ({ id: newId(), type: 'parent', parent, child });
  if (relation === 'first' || !anchor) return { people: [person], relationships: [] };
  switch (relation) {
    case 'parent':
      return { people: [person], relationships: [parentRel(person.id, anchor)] };
    case 'partner':
      return {
        people: [person],
        relationships: [
          { id: newId(), type: 'partner', a: anchor, b: person.id, ...(opts.weddingDate ? { weddingDate: opts.weddingDate } : {}) },
          ...(opts.coParentOf ?? []).map((child) => parentRel(person.id, child)),
        ],
      };
    case 'child': {
      const rels = [parentRel(anchor, person.id)];
      if (opts.otherParent) rels.push(parentRel(opts.otherParent, person.id));
      return { people: [person], relationships: rels };
    }
    case 'sibling': {
      const parents = parentsOf(ix, anchor);
      if (parents.length) return { people: [person], relationships: parents.map((p) => parentRel(p, person.id)) };
      if (!opts.placeholderId) throw new Error('A sibling needs shared parents');
      const placeholder: Person = { id: opts.placeholderId, name: PLACEHOLDER_NAME };
      return {
        people: [placeholder, person],
        relationships: [parentRel(placeholder.id, anchor), parentRel(placeholder.id, person.id)],
      };
    }
  }
}

/** Ids whose (mid)point the new connection line starts from. */
export function lineAnchorIds(ix: GraphIndex, anchor: string | null, relation: AddRelation, opts: AddOptions): string[] {
  if (!anchor || relation === 'first') return [];
  if (relation === 'child') {
    return opts.otherParent && partnersOf(ix, anchor).includes(opts.otherParent) ? [anchor, opts.otherParent] : [anchor];
  }
  if (relation === 'sibling') {
    const parents = parentsOf(ix, anchor);
    if (!parents.length) return opts.placeholderId ? [opts.placeholderId] : [anchor];
    if (parents.length === 2 && partnersOf(ix, parents[0]).includes(parents[1])) return [...parents];
    return [parents[0]];
  }
  return [anchor];
}

export function canAdd(ix: GraphIndex, anchor: string, relation: AddRelation): boolean {
  return relation !== 'parent' || parentsOf(ix, anchor).length < 2;
}

/** Children of `id` who have no other parent yet — a new partner is probably their parent too. */
export function singleParentChildren(ix: GraphIndex, id: string): string[] {
  return childrenOf(ix, id).filter((c) => parentsOf(ix, c).length === 1);
}

function isDescendant(ix: GraphIndex, ancestor: string, id: string): boolean {
  const stack = [...childrenOf(ix, ancestor)];
  const seen = new Set<string>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === id) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    stack.push(...childrenOf(ix, cur));
  }
  return false;
}

/** Existing people who may be linked as a parent of `child` without creating a loop. */
export function parentCandidates(ix: GraphIndex, child: string): string[] {
  if (parentsOf(ix, child).length >= 2) return [];
  return [...ix.ids].filter((id) => id !== child && !parentsOf(ix, child).includes(id) && !isDescendant(ix, child, id));
}

/** Likely other parent: partners of the existing parent who aren't a parent already. */
export function suggestedParents(ix: GraphIndex, child: string): string[] {
  const parents = parentsOf(ix, child);
  if (parents.length !== 1) return [];
  return partnersOf(ix, parents[0]).filter((p) => p !== child && !isDescendant(ix, child, p));
}
