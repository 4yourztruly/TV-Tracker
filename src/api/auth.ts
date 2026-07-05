/**
 * Google OAuth2 via Google Identity Services (GIS) "token client" — a
 * public client flow with no client secret, since this is a static SPA
 * with no backend. The access token is kept in memory only, never
 * written to storage, so it disappears on reload and isn't exposed to
 * storage-reading XSS.
 *
 * This app works like a local-first save/sync tool, not an
 * always-logged-in account: data lives on the device by default, and
 * signing in with Google is a deliberate, per-session action the user
 * takes (tapping "Sign in with Google" in Settings) whenever they want
 * to sync to Drive. There is no persisted "was signed in" flag and no
 * silent reconnect on app startup — every fresh load/refresh starts
 * signed out, even if the user synced to Drive last time. Within a
 * single session, once the user has signed in, the token is quietly
 * refreshed in the background (see trySilentSignIn and App.tsx's
 * refresh interval) so it doesn't expire mid-use — but that refresh
 * only ever keeps an already-active sign-in alive, it never starts a
 * new one on its own.
 */

// Loaded via <script src="https://accounts.google.com/gsi/client"> in index.html
declare const google: any;

// From Google Cloud Console > APIs & Services > Credentials > OAuth 2.0
// Client ID. Not a secret — safe to ship in the built JS bundle.
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

// App-only hidden Drive folder: the user can't see or hand-edit these
// files, and the token can't touch anything else in their Drive.
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

let tokenClient: any = null;
let accessToken: string | null = null;
let tokenExpiresAt: number | null = null;
let authReady = false;

type TokenListener = (token: string | null) => void;
type ReadyListener = (ready: boolean) => void;
const listeners = new Set<TokenListener>();
const readyListeners = new Set<ReadyListener>();

function notify(token: string | null) {
  listeners.forEach((fn) => fn(token));
}

function notifyReady(ready: boolean) {
  readyListeners.forEach((fn) => fn(ready));
}

export function onTokenChange(fn: TokenListener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function onGoogleAuthReady(fn: ReadyListener) {
  readyListeners.add(fn);
  fn(authReady);
  return () => readyListeners.delete(fn);
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function isTokenFresh(): boolean {
  return !!accessToken && !!tokenExpiresAt && Date.now() < tokenExpiresAt;
}

/** Call once on app startup, after the GIS script has loaded. Only sets
 * up the token client — it deliberately does NOT request a token, so
 * the app never prompts for Google sign-in on its own. Drive sync is
 * opt-in: nothing happens until the user taps "Sign in with Google". */
export function initGoogleAuth() {
  if (typeof google === 'undefined') {
    console.error('Google Identity Services script not loaded yet.');
    return;
  }

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: DRIVE_SCOPE,
    callback: (response: any) => {
      if (response.error) {
        console.error('Google auth error:', response.error);
        accessToken = null;
        tokenExpiresAt = null;
        notify(null);
        return;
      }
      accessToken = response.access_token;
      tokenExpiresAt = Date.now() + (response.expires_in - 60) * 1000;
      notify(accessToken);
    },
  });
  authReady = true;
  notifyReady(true);
}

/** Call from a user gesture (button click) to trigger sign-in. After
 * the user has already granted Drive access, this can usually reuse
 * that grant instead of forcing the full consent screen every time. */
export function requestSignIn(prompt: 'consent' | 'select_account' = 'consent'): boolean {
  if (!tokenClient) {
    console.error('Google auth not initialized yet.');
    return false;
  }
  tokenClient.requestAccessToken({ prompt });
  return true;
}

/** Silently (no popup) tries to reacquire a token — succeeds quietly if
 * there's still a valid Google session and prior consent from earlier
 * *this session*, and just as quietly does nothing visible if not. Only
 * used to keep an already-signed-in session's token fresh in the
 * background (see App.tsx's refresh interval); deliberately never
 * called on app startup, since sign-in isn't meant to persist across
 * reloads. */
export function trySilentSignIn() {
  if (!tokenClient) {
    console.error('Google auth not initialized yet.');
    return;
  }
  tokenClient.requestAccessToken({ prompt: '' });
}

/** Ensures a fresh token, silently refreshing if needed. Resolves once
 * available, or rejects if the user needs to interactively re-consent. */
export function ensureFreshToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (isTokenFresh() && accessToken) {
      resolve(accessToken);
      return;
    }
    if (!tokenClient) {
      reject(new Error('Google auth not initialized yet.'));
      return;
    }
    const unsubscribe = onTokenChange((token) => {
      unsubscribe();
      if (token) resolve(token);
      else reject(new Error('Failed to refresh Google access token.'));
    });
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

export function signOut() {
  if (accessToken && typeof google !== 'undefined') {
    google.accounts.oauth2.revoke(accessToken, () => {});
  }
  accessToken = null;
  tokenExpiresAt = null;
  notify(null);
}
