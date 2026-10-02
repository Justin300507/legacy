import { describe, expect, it } from 'vitest';
import { CALENDAR_NAME, googleCalendarApi, GoogleAuthError, planSync, syncCalendar, toEvent, type CalEvent, type CalendarApi } from './calendarSync';
import { familyDates, type FamilyDate } from './dates';
import type { Person, Relationship } from './types';

/** In-memory stand-in for Google Calendar. */
function fakeCalendar() {
  const calendars = new Map<string, Map<string, CalEvent>>();
  let n = 0;
  const calls: string[] = [];
  const api: CalendarApi = {
    async hasCalendar(id) {
      return calendars.has(id);
    },
    async createCalendar(summary) {
      calls.push(`create:${summary}`);
      const id = `cal${n++}`;
      calendars.set(id, new Map());
      return id;
    },
    async listEvents(id) {
      return [...calendars.get(id)!.values()];
    },
    async insertEvent(id, e) {
      calls.push('insert');
      const eid = `ev${n++}`;
      calendars.get(id)!.set(eid, { ...e, id: eid });
    },
    async updateEvent(id, eid, e) {
      calls.push('update');
      calendars.get(id)!.set(eid, { ...e, id: eid });
    },
    async deleteEvent(id, eid) {
      calls.push('delete');
      calendars.get(id)!.delete(eid);
    },
  };
  return { api, calendars, calls };
}

const people: Person[] = [
  { id: 'a', name: 'Eric', birthDate: '1990-03-03' },
  { id: 'b', name: 'Saby', birthDate: '1965-12-31', deathDate: '2020-06-15' },
];
const rels: Relationship[] = [{ id: 'r1', type: 'partner', a: 'a', b: 'b', weddingDate: '2015-06-20' }];
const titles = (events: Iterable<CalEvent>) => [...events].map((e) => e.summary).sort();

describe('toEvent', () => {
  const d: FamilyDate = { key: 'birth:a', kind: 'birthday', date: '1990-03-03', title: "Eric's birthday", description: 'x', people: ['a'] };

  it('is a yearly all-day event with week-before and day-before reminders at 9:00', () => {
    const e = toEvent(d);
    expect(e.start).toEqual({ date: '1990-03-03' });
    expect(e.end).toEqual({ date: '1990-03-04' });
    expect(e.recurrence).toEqual(['RRULE:FREQ=YEARLY']);
    expect(e.reminders.overrides.map((o) => o.minutes)).toEqual([9540, 900]);
    expect(e.extendedProperties.private.legacyKey).toBe('birth:a');
  });

  it('recurs leap-day birthdays on the last day of February', () => {
    expect(toEvent({ ...d, date: '2000-02-29' }).recurrence).toEqual(['RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1']);
    expect(toEvent({ ...d, date: '2000-02-29' }).end).toEqual({ date: '2000-03-01' });
  });

  it('changes its hash only when content changes', () => {
    expect(toEvent(d).extendedProperties.private.legacyHash).toBe(toEvent({ ...d }).extendedProperties.private.legacyHash);
    expect(toEvent(d).extendedProperties.private.legacyHash).not.toBe(toEvent({ ...d, title: 'other' }).extendedProperties.private.legacyHash);
  });
});

describe('syncCalendar', () => {
  it('creates the Legacy calendar and all events on first sync', async () => {
    const { api, calendars, calls } = fakeCalendar();
    const r = await syncCalendar(api, null, familyDates(people, rels), 'Asia/Kolkata');
    expect(calls[0]).toBe(`create:${CALENDAR_NAME}`);
    expect(r).toMatchObject({ inserted: 4, updated: 0, removed: 0, total: 4 });
    expect(titles(calendars.get(r.calendarId)!.values())).toEqual([
      "Eric & Saby's wedding anniversary",
      "Eric's birthday",
      'Remembering Saby',
      "Saby's birthday",
    ]);
  });

  it('is idempotent: a second sync changes nothing', async () => {
    const { api } = fakeCalendar();
    const first = await syncCalendar(api, null, familyDates(people, rels), 'UTC');
    const second = await syncCalendar(api, first.calendarId, familyDates(people, rels), 'UTC');
    expect(second).toMatchObject({ calendarId: first.calendarId, inserted: 0, updated: 0, removed: 0 });
  });

  it('updates edited dates and removes deleted ones', async () => {
    const { api, calendars } = fakeCalendar();
    const { calendarId } = await syncCalendar(api, null, familyDates(people, rels), 'UTC');
    const edited: Person[] = [{ ...people[0], name: 'Eric T', birthDate: '1990-03-04' }, { ...people[1], deathDate: undefined }];
    const r = await syncCalendar(api, calendarId, familyDates(edited, rels), 'UTC');
    expect(r).toMatchObject({ inserted: 0, updated: 3, removed: 1 }); // both birthdays + wedding title change; remembrance gone
    const events = [...calendars.get(calendarId)!.values()];
    expect(titles(events)).toEqual(["Eric T & Saby's wedding anniversary", "Eric T's birthday", "Saby's birthday"]);
    expect(events.find((e) => e.summary === "Eric T's birthday")!.start.date).toBe('1990-03-04');
  });

  it('recreates the calendar if it was deleted in Google Calendar', async () => {
    const { api, calendars } = fakeCalendar();
    const { calendarId } = await syncCalendar(api, null, familyDates(people, rels), 'UTC');
    calendars.delete(calendarId);
    const r = await syncCalendar(api, calendarId, familyDates(people, rels), 'UTC');
    expect(r.calendarId).not.toBe(calendarId);
    expect(r.inserted).toBe(4);
  });
});

describe('planSync', () => {
  it('removes duplicate copies of the same occasion', () => {
    const e = toEvent(familyDates(people, rels)[0]);
    const plan = planSync([e], [{ ...e, id: 'x1' }, { ...e, id: 'x2' }]);
    expect(plan).toEqual({ insert: [], update: [], remove: ['x2'] });
  });
});

describe('googleCalendarApi', () => {
  it('sends the bearer token and reports expired sign-in distinctly', async () => {
    const seen: RequestInit[] = [];
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      seen.push(init);
      return new Response(null, { status: 401 });
    }) as unknown as typeof fetch;
    await expect(googleCalendarApi('tok', fetchImpl).listEvents('c')).rejects.toBeInstanceOf(GoogleAuthError);
    expect((seen[0].headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('treats a missing calendar as absent rather than an error', async () => {
    const fetchImpl = (async () => new Response('{}', { status: 404 })) as unknown as typeof fetch;
    await expect(googleCalendarApi('tok', fetchImpl).hasCalendar('gone')).resolves.toBe(false);
  });
});
