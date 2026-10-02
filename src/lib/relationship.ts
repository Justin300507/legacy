import { isHalfSibling, reversePath, type GraphIndex } from './graph';
import type { Gender, Person, Step } from './types';

type Forms = readonly [male: string, female: string, neutral: string];

const pick = (f: Forms, g?: Gender) => (g === 'male' ? f[0] : g === 'female' ? f[1] : f[2]);

const PARENT: Forms = ['father', 'mother', 'parent'];
const CHILD: Forms = ['son', 'daughter', 'child'];
const SIBLING: Forms = ['brother', 'sister', 'sibling'];
const PARTNER: Forms = ['husband', 'wife', 'partner'];

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
const ordinal = (n: number) => ORDINALS[n - 1] ?? `${n}th`;
const removedText = (r: number) => (r === 1 ? 'once removed' : r === 2 ? 'twice removed' : `${r === 3 ? 'three' : r} times removed`);
const greats = (n: number) => 'great-'.repeat(Math.max(0, n));

/**
 * Common-ancestor method: `up` generations from A to the nearest common
 * ancestor, `down` generations from there to B. Returns what B is to A.
 */
export function bloodTerm(up: number, down: number, g?: Gender, half = false): string {
  if (up === 0 && down === 0) return 'self';
  if (down === 0) return up === 1 ? pick(PARENT, g) : greats(up - 2) + pick(['grandfather', 'grandmother', 'grandparent'], g);
  if (up === 0) return down === 1 ? pick(CHILD, g) : greats(down - 2) + pick(['grandson', 'granddaughter', 'grandchild'], g);
  if (up === 1 && down === 1) return (half ? 'half-' : '') + pick(SIBLING, g);
  if (down === 1) return greats(up - 2) + pick(['uncle', 'aunt', 'aunt/uncle'], g);
  if (up === 1) return greats(down - 2) + pick(['nephew', 'niece', 'niece/nephew'], g);
  const removed = Math.abs(up - down);
  return `${ordinal(Math.min(up, down) - 1)} cousin${removed ? ` ${removedText(removed)}` : ''}`;
}

const CODE = { parent: 'U', child: 'D', partner: 'P' } as const;

/** What the last person on `path` is to the first. */
export function relationshipLabel(path: Step[], ix: GraphIndex, genderOf: (id: string) => Gender | undefined): string {
  if (path.length === 0) return 'self';
  const a = path[0].from;
  const b = path[path.length - 1].to;
  const g = genderOf(b);
  const s = path.map((st) => CODE[st.kind]).join('');

  if (s === 'UPD') return 'step-' + pick(SIBLING, g);
  if (s === 'DU') return 'co-parent';

  const m = /^(P?)(U*)(D*)(P?)$/.exec(s);
  if (!m) return s.includes('P') ? 'relative by marriage' : 'relative';
  const pre = m[1] === 'P';
  const post = m[4] === 'P';
  const up = m[2].length;
  const down = m[3].length;

  if (!pre && !post) return bloodTerm(up, down, g, up === 1 && down === 1 && isHalfSibling(ix, a, b));
  if (up === 0 && down === 0) return pre && post ? 'relative by marriage' : pick(PARTNER, g);

  const term = bloodTerm(up, down, g);
  const isSibling = up === 1 && down === 1;
  if (pre && post) return isSibling ? `${term}-in-law` : 'relative by marriage';
  // partner's relative: ancestors/collaterals are in-laws, descendants are step-children
  if (pre) return up === 0 ? `step-${term}` : `${term}-in-law`;
  // relative's partner: ancestors' partners are step-parents, descendants'/siblings' are in-laws
  if (down === 0) return `step-${term}`;
  if (up === 0 || isSibling) return `${term}-in-law`;
  return `${term} by marriage`;
}

const cousinWord = (degree: number) => (degree === 1 ? 'cousin' : `${ordinal(degree)} cousin`);

/**
 * Everyday wording for what the last person on `path` is to the first. "Removed" cousins
 * become "mother's cousin" / "cousin's son"; everything else uses the standard label.
 */
export function plainLabel(path: Step[], ix: GraphIndex, genderOf: (id: string) => Gender | undefined): string {
  const formal = relationshipLabel(path, ix, genderOf);
  const s = path.map((st) => CODE[st.kind]).join('');
  const m = /^(U*)(D*)$/.exec(s);
  if (!m) return formal;
  const up = m[1].length;
  const down = m[2].length;
  if (up < 2 || down < 2) return formal;
  const degree = Math.min(up, down) - 1;
  if (up === down) return cousinWord(degree);
  if (up > down) {
    // B is the cousin of one of A's ancestors: name that ancestor through A's own line.
    const line = path.slice(0, up - down).map((st) => pick(PARENT, genderOf(st.to)));
    return `${line.join("'s ")}'s ${cousinWord(degree)}`;
  }
  // B descends from one of A's cousins.
  return `${cousinWord(degree)}'s ${bloodTerm(0, down - up, genderOf(path[path.length - 1].to))}`;
}

/**
 * label: what B is to A (formal); plain: the same in everyday words;
 * relation: what A is to B (formal). The sentence reads "B is A's <plain>".
 */
export type ConnectionDescription = { label: string; plain: string; relation: string; sentence: string; chain: string };

export function describeConnection(path: Step[], ix: GraphIndex, people: Map<string, Person>): ConnectionDescription {
  const genderOf = (id: string) => people.get(id)?.gender;
  const name = (id: string) => people.get(id)?.name ?? 'Unknown';
  if (path.length === 0) return { label: 'self', plain: 'self', relation: 'self', sentence: 'Same person', chain: '' };

  const a = path[0].from;
  const b = path[path.length - 1].to;
  const label = relationshipLabel(path, ix, genderOf);
  const plain = plainLabel(path, ix, genderOf);
  const relation = relationshipLabel(reversePath(path), ix, genderOf);
  const sentence = `${name(b)} is ${name(a)}'s ${plain}`;

  const parts = [name(a)];
  for (let i = 0; i < path.length; i++) {
    const st = path[i];
    const next = path[i + 1];
    if (st.kind === 'parent' && next?.kind === 'child') {
      const half = isHalfSibling(ix, st.from, next.to) ? 'half-' : '';
      parts.push(`${half}${pick(SIBLING, genderOf(next.to))} ${name(next.to)}`);
      i++;
      continue;
    }
    const forms = st.kind === 'parent' ? PARENT : st.kind === 'child' ? CHILD : PARTNER;
    parts.push(`${pick(forms, genderOf(st.to))} ${name(st.to)}`);
  }
  return { label, plain, relation, sentence, chain: parts.join(' → ') };
}
