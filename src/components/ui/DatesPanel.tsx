import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo } from 'react';
import { familyDates, formatDate, upcomingDates, type Upcoming } from '../../lib/dates';
import { googleSyncSupported, isNativeApp, preloadGoogle } from '../../lib/googleAuth';
import { flyToPerson } from '../../store/actions';
import { calendarAvailable, useCalendar } from '../../store/calendar';
import { useFamily } from '../../store/family';
import { useUI } from '../../store/ui';
import { useIsSmall } from './hooks';

const WINDOW_DAYS = 60;
const SITE = 'https://legacy-iota-two.vercel.app';

const KIND_LABEL = { birthday: 'Birthday', wedding: 'Anniversary', remembrance: 'Remembrance' } as const;

function when(u: Upcoming) {
  if (u.inDays === 0) return 'Today';
  if (u.inDays === 1) return 'Tomorrow';
  return `In ${u.inDays} days`;
}

function milestone(u: Upcoming, deceased: boolean) {
  if (u.years <= 0) return '';
  if (u.kind === 'birthday') return deceased ? `would be ${u.years}` : `turns ${u.years}`;
  return `${u.years} year${u.years === 1 ? '' : 's'}`;
}

function ago(ts: number) {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h} h ago` : new Date(ts).toLocaleDateString();
}

function CalendarCard() {
  const cal = useCalendar();
  if (!googleSyncSupported())
    return (
      <p className="dialog-hint">
        Google Calendar sync isn’t switched on here. Use <a href={SITE}>{SITE.replace('https://', '')}</a> or the Android app.
      </p>
    );
  if (!cal.enabled)
    return (
      <>
        <p className="dialog-hint">
          Add every birthday, wedding anniversary and remembrance day to a separate <b>Legacy</b> calendar in your Google Calendar, with reminders a week and a day before. It stays in sync as you edit the tree, and Legacy can’t see your other calendars.
        </p>
        {cal.status === 'error' && <p className="field-error">{cal.message}</p>}
        {cal.status === 'needs-signin' && cal.message && <p className="field-error">{cal.message}</p>}
        <button className="btn primary wide" disabled={cal.status === 'syncing'} onClick={() => void cal.connect()}>
          {cal.status === 'syncing' ? 'Connecting…' : 'Connect Google Calendar'}
        </button>
      </>
    );
  const r = cal.lastResult;
  return (
    <>
      <p className={`cal-status ${cal.status}`}>
        <span className="dot" />
        {cal.status === 'syncing'
          ? 'Syncing…'
          : cal.status === 'needs-signin' || cal.status === 'error'
            ? cal.message
            : cal.pending
              ? 'Changes waiting to sync…'
              : r
                ? `${r.total} date${r.total === 1 ? '' : 's'} in your Legacy calendar · synced ${cal.lastSync ? ago(cal.lastSync) : ''}`
                : 'Connected'}
      </p>
      <div className="panel-actions">
        <button className="btn primary" disabled={cal.status === 'syncing'} onClick={() => void cal.syncNow(true)}>
          {cal.status === 'needs-signin' ? 'Sign in & sync' : 'Sync now'}
        </button>
        <a className="btn" href="https://calendar.google.com/" target="_blank" rel="noreferrer">
          Open Calendar
        </a>
      </div>
      <button className="link" onClick={() => void cal.disconnect()}>
        Disconnect (keeps the Legacy calendar and its events)
      </button>
    </>
  );
}

export function DatesPanel() {
  const open = useUI((s) => s.datesOpen);
  const people = useFamily((s) => s.people);
  const relationships = useFamily((s) => s.relationships);
  const byId = useFamily((s) => s.byId);
  const small = useIsSmall();

  const dates = useMemo(() => familyDates(people, relationships), [people, relationships]);
  const upcoming = useMemo(() => upcomingDates(dates, new Date(), WINDOW_DAYS), [dates]);
  const counts = useMemo(() => {
    const c = { birthday: 0, wedding: 0, remembrance: 0 };
    for (const d of dates) c[d.kind]++;
    return c;
  }, [dates]);

  // Load Google's script early so the sign-in popup opens straight from the button click.
  useEffect(() => {
    if (open && calendarAvailable() && !isNativeApp()) preloadGoogle().catch(() => undefined);
  }, [open]);

  const close = () => useUI.getState().setDatesOpen(false);

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          key="dates"
          className="panel dates-panel"
          initial={small ? { y: '100%' } : { x: -380, opacity: 0 }}
          animate={small ? { y: 0 } : { x: 0, opacity: 1 }}
          exit={small ? { y: '100%' } : { x: -380, opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 280 }}
        >
          <button className="close" aria-label="Close" onClick={close}>
            ×
          </button>
          <h3>Dates & reminders</h3>

          <section className="relatives">
            <h4>Google Calendar</h4>
            <CalendarCard />
          </section>

          <section className="relatives">
            <h4>Next {WINDOW_DAYS} days</h4>
            {upcoming.length === 0 ? (
              <p className="dialog-hint">Nothing coming up.</p>
            ) : (
              <ul className="upcoming">
                {upcoming.map((u) => {
                  const deceased = u.kind === 'birthday' && !!byId.get(u.people[0])?.deathDate;
                  return (
                    <li key={u.key}>
                      <button className="relative" onClick={() => flyToPerson(u.people[0])}>
                        <span className={`date-badge ${u.kind}`}>
                          <b>{u.on.getDate()}</b>
                          <small>{u.on.toLocaleString(undefined, { month: 'short' })}</small>
                        </span>
                        <span className="upcoming-text">
                          <span>{u.title}</span>
                          <small>
                            {when(u)} · {KIND_LABEL[u.kind]}
                            {milestone(u, deceased) && ` · ${milestone(u, deceased)}`}
                          </small>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="relatives">
            <h4>In your tree</h4>
            <p className="dialog-hint">
              {counts.birthday} birthday{counts.birthday === 1 ? '' : 's'} · {counts.wedding} wedding anniversar{counts.wedding === 1 ? 'y' : 'ies'} · {counts.remembrance} remembrance
              day{counts.remembrance === 1 ? '' : 's'}
            </p>
            <p className="dialog-hint">
              Add birthdays and death dates with <b>Edit</b> on a person; wedding dates under their <b>Partners</b>. Dates show as e.g. {formatDate('1990-03-03', false)}.
            </p>
          </section>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
