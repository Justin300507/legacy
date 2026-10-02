import type { FamilyDate } from './dates';

/** The subset of a Google Calendar event resource that Legacy writes and reads. */
export type CalEvent = {
  id?: string;
  summary: string;
  description: string;
  start: { date: string };
  end: { date: string };
  recurrence: string[];
  transparency: 'transparent';
  reminders: { useDefault: false; overrides: { method: 'popup' | 'email'; minutes: number }[] };
  extendedProperties: { private: { legacyKey: string; legacyHash: string } };
};

export const CALENDAR_NAME = 'Legacy — Family dates';

// All-day reminders count back from midnight at the start of the day: 900 min = 9:00 the day before.
const DAY_BEFORE_9AM = 15 * 60;
const WEEK_BEFORE_9AM = 6 * 24 * 60 + 15 * 60;

function addDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return dt.toISOString().slice(0, 10);
}

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

export function toEvent(d: FamilyDate): CalEvent {
  // Feb 29 recurs on the last day of February so it still appears in non-leap years.
  const leapDay = d.date.endsWith('-02-29');
  const body = {
    summary: d.title,
    description: `${d.description}\n\nAdded by Legacy, your family tree.`,
    start: { date: d.date },
    end: { date: addDay(d.date) },
    recurrence: [leapDay ? 'RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1' : 'RRULE:FREQ=YEARLY'],
    transparency: 'transparent' as const,
    reminders: {
      useDefault: false as const,
      overrides: [
        { method: 'popup' as const, minutes: WEEK_BEFORE_9AM },
        { method: 'popup' as const, minutes: DAY_BEFORE_9AM },
      ],
    },
  };
  return { ...body, extendedProperties: { private: { legacyKey: d.key, legacyHash: hash(JSON.stringify(body)) } } };
}

export type SyncPlan = { insert: CalEvent[]; update: { id: string; event: CalEvent }[]; remove: string[] };

/** Diff what the tree wants against what the Legacy calendar holds, matched by legacyKey. */
export function planSync(desired: CalEvent[], existing: CalEvent[]): SyncPlan {
  const plan: SyncPlan = { insert: [], update: [], remove: [] };
  const byKey = new Map<string, CalEvent>();
  for (const e of existing) {
    const key = e.extendedProperties?.private?.legacyKey;
    // Duplicates (e.g. two devices inserting at once) or foreign events: keep one per key, drop the rest.
    if (!key || byKey.has(key)) {
      if (e.id && key) plan.remove.push(e.id);
      continue;
    }
    byKey.set(key, e);
  }
  for (const d of desired) {
    const key = d.extendedProperties.private.legacyKey;
    const have = byKey.get(key);
    byKey.delete(key);
    if (!have) plan.insert.push(d);
    else if (have.extendedProperties.private.legacyHash !== d.extendedProperties.private.legacyHash) plan.update.push({ id: have.id!, event: d });
  }
  for (const leftover of byKey.values()) if (leftover.id) plan.remove.push(leftover.id);
  return plan;
}

export interface CalendarApi {
  /** True if the calendar exists and is accessible. */
  hasCalendar(id: string): Promise<boolean>;
  createCalendar(summary: string, timeZone: string): Promise<string>;
  listEvents(calendarId: string): Promise<CalEvent[]>;
  insertEvent(calendarId: string, event: CalEvent): Promise<void>;
  updateEvent(calendarId: string, id: string, event: CalEvent): Promise<void>;
  deleteEvent(calendarId: string, id: string): Promise<void>;
}

export type SyncResult = { calendarId: string; inserted: number; updated: number; removed: number; total: number };

async function inBatches<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

export async function syncCalendar(api: CalendarApi, calendarId: string | null, dates: FamilyDate[], timeZone: string): Promise<SyncResult> {
  let id = calendarId && (await api.hasCalendar(calendarId)) ? calendarId : null;
  if (!id) id = await api.createCalendar(CALENDAR_NAME, timeZone);
  const desired = dates.map(toEvent);
  const plan = planSync(desired, await api.listEvents(id));
  await inBatches(plan.insert, 4, (e) => api.insertEvent(id, e));
  await inBatches(plan.update, 4, (u) => api.updateEvent(id, u.id, u.event));
  await inBatches(plan.remove, 4, (r) => api.deleteEvent(id, r));
  return { calendarId: id, inserted: plan.insert.length, updated: plan.update.length, removed: plan.remove.length, total: desired.length };
}

export class GoogleAuthError extends Error {}

/** Thin fetch wrapper over the Google Calendar v3 REST API. */
export function googleCalendarApi(token: string, fetchImpl: typeof fetch = fetch): CalendarApi {
  const base = 'https://www.googleapis.com/calendar/v3';
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await fetchImpl(base + path, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) throw new GoogleAuthError('Google sign-in expired');
    return res;
  };
  const ok = async (res: Response) => {
    if (res.ok) return res;
    let msg = `Google Calendar error ${res.status}`;
    try {
      msg = (await res.json())?.error?.message ?? msg;
    } catch {
      /* keep status message */
    }
    throw new Error(msg);
  };
  const cal = (id: string) => `/calendars/${encodeURIComponent(id)}`;
  return {
    async hasCalendar(id) {
      const res = await call('GET', cal(id));
      if (res.status === 404 || res.status === 403 || res.status === 410) return false;
      await ok(res);
      return true;
    },
    async createCalendar(summary, timeZone) {
      const res = await ok(await call('POST', '/calendars', { summary, timeZone, description: 'Birthdays, wedding anniversaries and remembrance days from your Legacy family tree.' }));
      return (await res.json()).id as string;
    },
    async listEvents(calendarId) {
      const out: CalEvent[] = [];
      let pageToken = '';
      do {
        const q = new URLSearchParams({ maxResults: '2500', showDeleted: 'false' });
        if (pageToken) q.set('pageToken', pageToken);
        const data = await (await ok(await call('GET', `${cal(calendarId)}/events?${q}`))).json();
        out.push(...(data.items ?? []));
        pageToken = data.nextPageToken ?? '';
      } while (pageToken);
      return out;
    },
    async insertEvent(calendarId, event) {
      await ok(await call('POST', `${cal(calendarId)}/events`, event));
    },
    async updateEvent(calendarId, id, event) {
      await ok(await call('PUT', `${cal(calendarId)}/events/${encodeURIComponent(id)}`, event));
    },
    async deleteEvent(calendarId, id) {
      const res = await call('DELETE', `${cal(calendarId)}/events/${encodeURIComponent(id)}`);
      if (res.status !== 404 && res.status !== 410) await ok(res);
    },
  };
}
