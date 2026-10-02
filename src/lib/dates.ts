import type { Person, Relationship } from './types';

/** A yearly family occasion derived from the tree. `key` is stable across edits. */
export type FamilyDate = {
  key: string;
  kind: 'birthday' | 'wedding' | 'remembrance';
  /** Original date, YYYY-MM-DD. */
  date: string;
  title: string;
  description: string;
  /** Ids of the people involved (for flying to them from the UI). */
  people: string[];
};

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDate(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const m = ISO.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return y >= 1 && dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "3 Mar 1990" */
export function formatDate(iso: string, withYear = true): string {
  const m = ISO.exec(iso);
  if (!m) return iso;
  const day = `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}`;
  return withYear ? `${day} ${m[1]}` : day;
}

export const yearOf = (iso: string) => Number(iso.slice(0, 4));

export function familyDates(people: Person[], relationships: Relationship[]): FamilyDate[] {
  const byId = new Map(people.map((p) => [p.id, p]));
  const out: FamilyDate[] = [];
  for (const p of people) {
    const name = p.name || 'Unnamed';
    if (isValidDate(p.birthDate)) {
      out.push({
        key: `birth:${p.id}`,
        kind: 'birthday',
        date: p.birthDate,
        title: `${name}'s birthday`,
        description: `${name} was born on ${formatDate(p.birthDate)}.${p.deathDate ? ' Remembered with love.' : ''}`,
        people: [p.id],
      });
    }
    if (isValidDate(p.deathDate)) {
      out.push({
        key: `death:${p.id}`,
        kind: 'remembrance',
        date: p.deathDate,
        title: `Remembering ${name}`,
        description: `${name} passed away on ${formatDate(p.deathDate)}.`,
        people: [p.id],
      });
    }
  }
  for (const r of relationships) {
    if (r.type !== 'partner' || !isValidDate(r.weddingDate)) continue;
    const a = byId.get(r.a);
    const b = byId.get(r.b);
    if (!a || !b) continue;
    out.push({
      key: `wedding:${r.id}`,
      kind: 'wedding',
      date: r.weddingDate,
      title: `${a.name} & ${b.name}'s wedding anniversary`,
      description: `${a.name} and ${b.name} were married on ${formatDate(r.weddingDate)}.`,
      people: [a.id, b.id],
    });
  }
  return out;
}

/** Next date (local, at midnight) on or after `from` when this occasion falls. Feb 29 falls on Feb 28 in non-leap years. */
export function nextOccurrence(iso: string, from: Date): Date {
  const m = ISO.exec(iso)!;
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let y = start.getFullYear(); ; y++) {
    const last = new Date(y, month + 1, 0).getDate();
    const d = new Date(y, month, Math.min(day, last));
    if (d >= start) return d;
  }
}

export type Upcoming = FamilyDate & { on: Date; inDays: number; years: number };

/** Occasions in the next `days` days, soonest first, with how many years it will be. */
export function upcomingDates(dates: FamilyDate[], from: Date, days: number): Upcoming[] {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return dates
    .map((d) => {
      const on = nextOccurrence(d.date, start);
      return { ...d, on, inDays: Math.round((on.getTime() - start.getTime()) / 86400000), years: on.getFullYear() - yearOf(d.date) };
    })
    .filter((d) => d.inDays <= days)
    .sort((a, b) => a.inDays - b.inDays || a.title.localeCompare(b.title));
}
