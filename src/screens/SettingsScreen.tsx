import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/store';
import { requestSignIn, signOut } from '../api/auth';
import { exportTrackerData, importTrackerData } from '../utils/exportImport';
import { computeWatchStats, formatWatchTime } from '../utils/stats';
import { syncToDrive } from '../store/sync';
import { Toggle } from '../components/Toggle';
import type { TrackerData } from '../types/show';

export function SettingsScreen() {
  const isSignedIn = useAppStore((s) => s.isSignedIn);
  const isGoogleAuthReady = useAppStore((s) => s.isGoogleAuthReady);
  const driveSyncEnabled = useAppStore((s) => s.driveSyncEnabled);
  const onlyShowWatching = useAppStore((s) => s.onlyShowWatching);
  const setOnlyShowWatching = useAppStore((s) => s.setOnlyShowWatching);
  // The user has signed in before (driveSyncEnabled is a persisted
  // preference, not a credential) but we don't have a live token yet —
  // e.g. right after a page load, while the silent background
  // reconnect is still in flight. Distinct from never having signed in
  // at all, so this doesn't read as "you've been logged out."
  const [reconnectTimedOut, setReconnectTimedOut] = useState(false);
  const isReconnecting = driveSyncEnabled && !isSignedIn && !reconnectTimedOut;

  // If the silent reconnect hasn't resolved after a few seconds (e.g.
  // the Google consent grant actually expired, or the user is offline),
  // stop showing "Reconnecting..." indefinitely and fall back to a
  // normal, clickable "Sign in" button instead.
  useEffect(() => {
    if (!driveSyncEnabled || isSignedIn) {
      setReconnectTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setReconnectTimedOut(true), 6000);
    return () => clearTimeout(timer);
  }, [driveSyncEnabled, isSignedIn]);
  const shows = useAppStore((s) => s.shows);
  const replaceAllShows = useAppStore((s) => s.replaceAllShows);
  const lastSyncedAt = useAppStore((s) => s.lastSyncedAt);
  const setDriveSyncEnabled = useAppStore((s) => s.setDriveSyncEnabled);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  const stats = computeWatchStats(shows);

  function handleSignIn() {
    const wasEnabled = useAppStore.getState().driveSyncEnabled;
    const started = requestSignIn(wasEnabled ? 'select_account' : 'consent');
    if (started) {
      setDriveSyncEnabled(true);
      setMessage(null);
    } else {
      setMessage('Google sign-in is still loading. Try again in a moment.');
    }
  }

  function handleSignOut() {
    setDriveSyncEnabled(false);
    signOut();
  }

  function handleExport() {
    const data: TrackerData = { version: 1, shows };
    exportTrackerData(data);
    setMessage('Export downloaded.');
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await importTrackerData(file);
      replaceAllShows(data.shows);
      syncToDrive();
      setMessage(`Imported ${data.shows.length} show(s).`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      e.target.value = '';
    }
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-4">
      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400">Account</h2>
        {isSignedIn ? (
          <button
            onClick={handleSignOut}
            className="rounded-lg border border-ink-700 px-4 py-2 text-left text-sm font-medium text-ink-100 hover:border-red-400 hover:text-red-400"
          >
            Sign out
          </button>
        ) : isReconnecting ? (
          <div className="flex flex-col gap-2">
            <button
              disabled
              className="rounded-lg border border-ink-700 px-4 py-2 text-left text-sm font-medium text-ink-400"
            >
              Reconnecting to Google...
            </button>
            <button
              onClick={handleSignIn}
              disabled={!isGoogleAuthReady}
              className="text-left text-xs text-signal-500 hover:underline disabled:opacity-50"
            >
              Taking too long? Tap to sign in manually
            </button>
          </div>
        ) : (
          <button
            onClick={handleSignIn}
            disabled={!isGoogleAuthReady}
            className="rounded-lg bg-signal-500 px-4 py-2 text-left text-sm font-semibold text-ink-950 hover:bg-signal-600 disabled:opacity-50"
          >
            {isGoogleAuthReady ? 'Sign in with Google' : 'Loading Google sign-in...'}
          </button>
        )}
        {lastSyncedAt && (
          <p className="text-xs text-ink-400">
            Last synced: {new Date(lastSyncedAt).toLocaleString()}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400">Display</h2>
        <Toggle
          checked={onlyShowWatching}
          onChange={setOnlyShowWatching}
          label="Only show Watching"
          description="Hide Watchlist, Up to date, and Completed on the home screen."
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400">Stats</h2>
        {stats.totalEpisodesWatched === 0 ? (
          <p className="text-xs text-ink-400">
            No episodes watched yet — your stats will show up here once you start tracking.
          </p>
        ) : (
          <div className="rounded-lg border border-ink-800 bg-ink-900 p-3">
            <p className="text-2xl font-semibold text-signal-500">
              {formatWatchTime(stats.totalMinutesWatched)}
            </p>
            <p className="text-xs text-ink-400">
              spent watching {stats.totalEpisodesWatched} episode
              {stats.totalEpisodesWatched === 1 ? '' : 's'}
            </p>
            <div className="mt-3 flex gap-4 border-t border-ink-800 pt-3 text-xs text-ink-300">
              <span>{stats.showsWatching} watching</span>
              <span>{stats.showsCompleted} completed</span>
              <span>{stats.showsOnWatchlist} watchlist</span>
            </div>
          </div>
        )}
        <p className="text-xs text-ink-400">
          Watch time is estimated from each show's average episode runtime
          (falls back to ~24 min when a source doesn't report one).
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400">Data</h2>
        <p className="text-xs text-ink-400">
          Your data lives on this device by default — no account needed.
          Optionally sign in with Google to back it up and sync it to a
          hidden folder in your Drive that only this app can read.
          Use export/import below to back it up or move it manually either way.
        </p>
        <button
          onClick={handleExport}
          className="rounded-lg border border-ink-700 px-4 py-2 text-left text-sm font-medium text-ink-100 hover:border-signal-500"
        >
          Export data (.json)
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg border border-ink-700 px-4 py-2 text-left text-sm font-medium text-ink-100 hover:border-signal-500"
        >
          Import data (.json)
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          onChange={handleImportFile}
          className="hidden"
        />
        {message && <p className="text-xs text-ink-200">{message}</p>}
      </section>

      <section className="flex flex-col gap-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400">About</h2>
        <p className="text-xs text-ink-400">TV Tracker · episode counts via TMDB and MyAnimeList (Jikan)</p>
      </section>
    </div>
  );
}
