/**
 * Google sign-in for Calendar. Website: Google Identity Services token flow (no backend).
 * Android app: native Play services authorization via the GoogleAuth plugin, since Google
 * blocks OAuth inside WebViews.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';

// Least privilege: only calendars this app creates — never the user's other calendars.
const SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';
const TOKEN_KEY = 'legacy.googleToken';

export const googleClientId: string | undefined = import.meta.env.VITE_GOOGLE_CLIENT_ID || undefined;

type TokenResponse = { access_token?: string; expires_in?: number; error?: string; error_description?: string };
type TokenClient = { requestAccessToken: (o?: { prompt?: string }) => void };
type Gis = {
  accounts: {
    oauth2: {
      initTokenClient: (cfg: {
        client_id: string;
        scope: string;
        callback: (r: TokenResponse) => void;
        error_callback?: (e: { type?: string; message?: string }) => void;
      }) => TokenClient;
      revoke: (token: string, done?: () => void) => void;
    };
  };
};
declare global {
  interface Window {
    google?: Gis;
  }
}

let script: Promise<void> | null = null;

/** Load the Google script ahead of time so the sign-in popup can open straight from a click. */
export function preloadGoogle(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  script ??= new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = 'https://accounts.google.com/gsi/client';
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => {
      script = null;
      reject(new Error('Could not reach Google. Check your internet connection.'));
    };
    document.head.appendChild(el);
  });
  return script;
}

type Stored = { value: string; expiresAt: number };

function stored(): Stored | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(TOKEN_KEY) ?? 'null') as Stored | null;
    return s && s.expiresAt - 60_000 > Date.now() ? s : null;
  } catch {
    return null;
  }
}

export const hasValidToken = () => stored() !== null;

function remember(value: string, seconds: number) {
  try {
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ value, expiresAt: Date.now() + seconds * 1000 }));
  } catch {
    /* private mode: token just won't survive a reload */
  }
}

type NativeGoogleAuth = {
  authorize(o: { interactive: boolean }): Promise<{ accessToken?: string; needsInteraction?: boolean }>;
  clearToken(o: { token: string }): Promise<void>;
};
const NativeGoogle = registerPlugin<NativeGoogleAuth>('GoogleAuth');
export const isNativeApp = () => Capacitor.isNativePlatform();

/** Sync can run here: the Android app (native sign-in) or a website with a configured client ID. */
export const googleSyncSupported = () => isNativeApp() || !!googleClientId;

async function nativeToken(interactive: boolean): Promise<string | null> {
  try {
    const r = await NativeGoogle.authorize({ interactive });
    if (!r.accessToken) return null;
    // Play services doesn't report expiry; access tokens last an hour, refresh a little early.
    remember(r.accessToken, 50 * 60);
    return r.accessToken;
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.code === 'CANCELED') throw new Error('Sign-in window was closed');
    throw new Error(err.message || 'Google sign-in failed');
  }
}

/**
 * A valid access token. Non-interactive calls return null when the user must sign in again
 * (tokens last about an hour; a popup can only open from a click).
 */
export async function getGoogleToken(interactive: boolean): Promise<string | null> {
  const cached = stored();
  if (cached) return cached.value;
  // Native can refresh silently when access was granted before, so auto-sync keeps working.
  if (isNativeApp()) return nativeToken(interactive);
  if (!interactive) return null;
  if (!googleClientId) throw new Error('Google Calendar is not configured for this site yet.');
  if (!window.google?.accounts?.oauth2) await preloadGoogle();
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: googleClientId,
      scope: SCOPE,
      callback: (r) => {
        if (r.error || !r.access_token) return reject(new Error(r.error_description || r.error || 'Google sign-in failed'));
        const value = r.access_token;
        remember(value, r.expires_in ?? 3600);
        resolve(value);
      },
      error_callback: (e) => reject(new Error(e.type === 'popup_closed' ? 'Sign-in window was closed' : e.message || 'Google sign-in failed')),
    });
    client.requestAccessToken({ prompt: '' });
  });
}

export function forgetGoogleToken() {
  const s = stored();
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
  if (!s) return;
  if (isNativeApp()) void NativeGoogle.clearToken({ token: s.value }).catch(() => undefined);
  else if (window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(s.value);
}
