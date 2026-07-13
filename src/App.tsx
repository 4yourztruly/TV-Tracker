import { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { TabBar } from './components/TabBar';
import { Spinner } from './components/Spinner';
import { HomeScreen } from './screens/HomeScreen';
import { SearchScreen } from './screens/SearchScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { ShowDetailScreen } from './screens/ShowDetailScreen';
import { useAppStore } from './store/store';
import { initGoogleAuth, onGoogleAuthReady, onTokenChange, trySilentSignIn, isTokenFresh } from './api/auth';

// Google access tokens only last ~1 hour. Rather than waiting for one to
// go stale mid-use and forcing a Drive call to block on a refresh, we
// proactively re-request a fresh one in the background every 45 minutes
// while the app stays open and the user is currently signed in for this
// session. This is still the same silent (prompt: '') flow — it doesn't
// show anything as long as the session's Google consent is still valid.
// It never runs unless the user is already signed in right now — it
// keeps an active session alive, it doesn't start a new one.
const SILENT_REFRESH_INTERVAL_MS = 45 * 60 * 1000;
import { loadFromDrive, saveToDriveNow } from './store/sync';

function loadGisScript(onReady: () => void) {
  const existing = document.getElementById('gis-script');
  if (existing) {
    onReady();
    return;
  }
  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.id = 'gis-script';
  script.async = true;
  script.defer = true;
  script.onload = onReady;
  document.head.appendChild(script);
}

export default function App() {
  const activeTab = useAppStore((s) => s.activeTab);
  const selectedShowId = useAppStore((s) => s.selectedShowId);
  const previewShow = useAppStore((s) => s.previewShow);
  const setSignedIn = useAppStore((s) => s.setSignedIn);
  const setGoogleAuthReady = useAppStore((s) => s.setGoogleAuthReady);

  // The tracked shows list lives in IndexedDB and is read back in
  // asynchronously by zustand's persist middleware. Without this gate,
  // the Home screen briefly renders as if nothing were tracked yet and
  // then pops in the real list a moment later — hold a spinner over
  // just the content area (Header/TabBar stay put and usable) until
  // that initial read completes instead.
  const [hasHydrated, setHasHydrated] = useState(() => useAppStore.persist.hasHydrated());

  useEffect(() => {
    if (hasHydrated) return;
    const unsubscribe = useAppStore.persist.onFinishHydration(() => setHasHydrated(true));
    // Safety net: on iOS Safari/WKWebView, IndexedDB's open request can
    // occasionally just hang — never firing onsuccess, onerror, or
    // onblocked — which would otherwise leave this gate (and the whole
    // app) stuck on a spinner forever. Give up waiting after 8s (same
    // timeout HomeScreen's own readyTimedOut safety net uses) and show
    // the app anyway; if hydration does eventually settle after that,
    // the store's own state update still flows through normally.
    const timeout = setTimeout(() => setHasHydrated(true), 8000);
    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, [hasHydrated]);

  useEffect(() => {
    const unsubscribeReady = onGoogleAuthReady(setGoogleAuthReady);
    const unsubscribeToken = onTokenChange((token) => {
      setSignedIn(!!token);
      if (token) {
        // Signing in never implies save OR load on its own — only run
        // whichever explicit action (if any) the user actually pressed
        // in Settings ("Save to Drive" / "Load from Drive") to get here.
        // A silent background token refresh, for instance, comes through
        // this same listener with no pending action and should do
        // nothing but keep the session alive.
        const pending = useAppStore.getState().pendingSyncAction;
        if (pending === 'save') {
          saveToDriveNow();
        } else if (pending === 'load') {
          loadFromDrive();
        }
        useAppStore.getState().setPendingSyncAction(null);
      } else {
        useAppStore.getState().setDriveFileId(null);
        useAppStore.getState().setPendingSyncAction(null);
      }
    });

    let refreshInterval: ReturnType<typeof setInterval> | undefined;

    function connectGoogleAuth() {
      loadGisScript(() => {
        // Just sets up the token client — deliberately does NOT request a
        // token or attempt any silent reconnect here. Sign-in is a
        // per-session, user-initiated action (tap "Sign in with Google" in
        // Settings): on every fresh load/refresh the app starts out
        // signed out and works entirely off local data, exactly as if the
        // user had never signed in, even if they synced to Drive last time.
        initGoogleAuth();
        // Keep quietly renewing in the background so a long-open tab
        // never sits on an expired token mid-session — but only once the
        // user has actually signed in this session. This never starts a
        // new sign-in on its own, it just keeps an active one alive.
        refreshInterval = setInterval(() => {
          if (useAppStore.getState().isSignedIn && !isTokenFresh()) {
            trySilentSignIn();
          }
        }, SILENT_REFRESH_INTERVAL_MS);
      });
    }

    let unsubscribeHydration: (() => void) | undefined;
    if (useAppStore.persist.hasHydrated()) {
      connectGoogleAuth();
    } else {
      unsubscribeHydration = useAppStore.persist.onFinishHydration(connectGoogleAuth);
    }

    return () => {
      unsubscribeHydration?.();
      unsubscribeToken();
      unsubscribeReady();
      if (refreshInterval) clearInterval(refreshInterval);
    };
  }, [setGoogleAuthReady, setSignedIn]);

  return (
    <div className="flex min-h-dvh w-full justify-center bg-ink-950">
      <div className="flex h-dvh w-full max-w-[480px] flex-col md:border-x md:border-ink-800">
        <Header />
        <main className="min-h-0 flex-1 overflow-y-auto">
          {/* Only Home depends on the hydrated `shows` list, so it's the
              only tab that needs to wait for it — Search hits live APIs
              regardless, and Settings' own stats/toggles read fine off
              whatever's in the store the instant it renders. Gating the
              whole tab bar on hydration made Search/Settings show a
              pointless spinner on every launch. */}
          {activeTab === 'home' &&
            (hasHydrated ? (
              <HomeScreen />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Spinner size={40} />
              </div>
            ))}
          {activeTab === 'search' && <SearchScreen />}
          {activeTab === 'settings' && <SettingsScreen />}
        </main>
        <TabBar />
        {hasHydrated && (selectedShowId || previewShow) && <ShowDetailScreen />}
      </div>
    </div>
  );
}
