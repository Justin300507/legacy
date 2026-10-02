import { create } from 'zustand';
import { googleCalendarApi, GoogleAuthError, syncCalendar, type SyncResult } from '../lib/calendarSync';
import { familyDates } from '../lib/dates';
import { getSetting, setSetting } from '../lib/db';
import { forgetGoogleToken, getGoogleToken, googleClientId } from '../lib/googleAuth';
import { useFamily } from './family';

type Saved = { enabled: boolean; calendarId: string | null; lastSync: number | null; lastResult: SyncResult | null };

type CalendarState = Saved & {
  loaded: boolean;
  status: 'idle' | 'syncing' | 'ok' | 'needs-signin' | 'error';
  message: string | null;
  /** Tree changed since the last successful sync. */
  pending: boolean;
  init: () => Promise<void>;
  connect: () => Promise<void>;
  syncNow: (interactive?: boolean) => Promise<void>;
  disconnect: () => Promise<void>;
};

const SETTING = 'googleCalendar';
const AUTO_SYNC_DELAY = 2500;

export const calendarAvailable = () => !!googleClientId && !(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();

let running: Promise<void> | null = null;
let again = false;

export const useCalendar = create<CalendarState>((set, get) => {
  const save = (patch: Partial<Saved>) => {
    set(patch);
    const { enabled, calendarId, lastSync, lastResult } = { ...get(), ...patch };
    void setSetting(SETTING, { enabled, calendarId, lastSync, lastResult });
  };

  const run = async (interactive: boolean) => {
    const token = await getGoogleToken(interactive);
    if (!token) {
      set({ status: 'needs-signin', message: 'Sign in again to sync your latest changes.' });
      return;
    }
    set({ status: 'syncing', message: null });
    const { people, relationships } = useFamily.getState();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const result = await syncCalendar(googleCalendarApi(token), get().calendarId, familyDates(people, relationships), tz);
    save({ calendarId: result.calendarId, lastSync: Date.now(), lastResult: result });
    set({ status: 'ok', pending: false });
  };

  const syncNow = async (interactive = true) => {
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      try {
        do {
          again = false;
          await run(interactive);
        } while (again && get().status === 'ok');
      } catch (e) {
        if (e instanceof GoogleAuthError) {
          forgetGoogleToken();
          set({ status: 'needs-signin', message: 'Google sign-in expired. Sign in again to sync.' });
        } else set({ status: 'error', message: e instanceof Error ? e.message : String(e) });
      } finally {
        running = null;
      }
    })();
    return running;
  };

  return {
    enabled: false,
    calendarId: null,
    lastSync: null,
    lastResult: null,
    loaded: false,
    status: 'idle',
    message: null,
    pending: false,
    async init() {
      const saved = await getSetting<Saved>(SETTING);
      set({ ...(saved ?? {}), loaded: true });
      if (saved?.enabled && calendarAvailable()) void syncNow(false);
    },
    async connect() {
      save({ enabled: true });
      await syncNow(true);
      // Sign-in cancelled or the first sync failed: stay disconnected so nothing retries silently.
      if (get().status !== 'ok') save({ enabled: false });
    },
    syncNow,
    async disconnect() {
      forgetGoogleToken();
      // Keep calendarId so reconnecting reuses the same "Legacy" calendar instead of making another.
      save({ enabled: false });
      set({ status: 'idle', message: null, pending: false });
    },
  };
});

/** Keep Google Calendar in step with the tree: any change to people or links re-syncs shortly after. */
let timer: ReturnType<typeof setTimeout> | undefined;
useFamily.subscribe((s, prev) => {
  if (!s.loaded || !prev.loaded) return;
  if (s.people === prev.people && s.relationships === prev.relationships) return;
  const cal = useCalendar.getState();
  if (!cal.enabled || !calendarAvailable()) return;
  useCalendar.setState({ pending: true });
  clearTimeout(timer);
  timer = setTimeout(() => void useCalendar.getState().syncNow(false), AUTO_SYNC_DELAY);
});
