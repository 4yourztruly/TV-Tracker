import { useRef, useState } from 'react';
import { useAppStore } from '../store/store';
import { requestSignIn, signOut } from '../api/auth';
import { exportTrackerData, importTrackerData } from '../utils/exportImport';
import { computeWatchStats, formatWatchTimeAs, WATCH_TIME_UNITS, type WatchTimeUnit } from '../utils/stats';
import { syncToDrive, loadFromDrive, saveToDriveNow } from '../store/sync';
import { Toggle } from '../components/Toggle';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { TrackerData } from '../types/show';

export function SettingsScreen() {
  const isSignedIn = useAppStore((s) => s.isSignedIn);
  const isGoogleAuthReady = useAppStore((s) => s.isGoogleAuthReady);
  const syncStatus = useAppStore((s) => s.syncStatus);
  const onlyShowWatching = useAppStore((s) => s.onlyShowWatching);
  const setOnlyShowWatching = useAppStore((s) => s.setOnlyShowWatching);
  const shows = useAppStore((s) => s.shows);
  const replaceAllShows = useAppStore((s) => s.replaceAllShows);
  const lastSyncedAt = useAppStore((s) => s.lastSyncedAt);
  const setPendingSyncAction = useAppStore((s) => s.setPendingSyncAction);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmLoad, setConfirmLoad] = useState(false);
  const [watchTimeUnit, setWatchTimeUnit] = useState<WatchTimeUnit>('auto');

  const stats = computeWatchStats(shows);
  const busy = syncStatus === 'syncing';

  // Signed in before (lastSyncedAt is a persisted timestamp, not a
  // credential) → let Google reuse that prior consent instead of
  // forcing the full permission screen again.
  function startSignIn() {
    const signedInBefore = useAppStore.getState().lastSyncedAt !== null;
    return requestSignIn(signedInBefore ? 'select_account' : 'consent');
  }

  // "Save to Drive" — a deliberate, user-initiated push. If we're not
  // signed in yet this session, kick off sign-in first and remember to
  // save as soon as the token comes back; otherwise save immediately.
  function handleSaveToDrive() {
    setMessage(null);
    if (isSignedIn) {
      saveToDriveNow();
      return;
    }
    setPendingSyncAction('save');
    if (!startSignIn()) {
      setPendingSyncAction(null);
      setMessage('Google sign-in is still loading. Try again in a moment.');
    }
  }

  // "Load from Drive" overwrites local data, so confirm first.
  function handleLoadFromDrive() {
    setMessage(null);
    setConfirmLoad(true);
  }

  function confirmAndLoad() {
    setConfirmLoad(false);
    if (isSignedIn) {
      loadFromDrive();
      return;
    }
    setPendingSyncAction('load');
    if (!startSignIn()) {
      setPendingSyncAction(null);
      setMessage('Google sign-in is still loading. Try again in a moment.');
    }
  }

  function handleSignOut() {
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
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400">Drive sync</h2>
        <p className="text-xs text-ink-400">
          Nothing syncs on its own. Tap "Save to Drive" to sign in and back up
          this device's data, or "Load from Drive" to sign in and pull down
          whatever was last saved. Neither happens automatically — not on
          sign-in, not on refresh, not on app start.
        </p>
        <button
          onClick={handleSaveToDrive}
          disabled={!isGoogleAuthReady || busy}
          className="rounded-lg bg-signal-500 px-4 py-2 text-left text-sm font-semibold text-ink-950 hover:bg-signal-600 disabled:opacity-50"
        >
          {!isGoogleAuthReady
            ? 'Loading Google sign-in...'
            : busy
              ? 'Saving...'
              : isSignedIn
                ? 'Save to Drive'
                : 'Sign in & save to Drive'}
        </button>
        <button
          onClick={handleLoadFromDrive}
          disabled={!isGoogleAuthReady || busy}
          className="rounded-lg border border-ink-700 px-4 py-2 text-left text-sm font-medium text-ink-100 hover:border-signal-500 disabled:opacity-50"
        >
          {!isGoogleAuthReady
            ? 'Loading Google sign-in...'
            : busy
              ? 'Loading...'
              : isSignedIn
                ? 'Load from Drive'
                : 'Sign in & load from Drive'}
        </button>
        {isSignedIn && (
          <button
            onClick={handleSignOut}
            className="rounded-lg border border-ink-700 px-4 py-2 text-left text-sm font-medium text-ink-100 hover:border-red-400 hover:text-red-400"
          >
            Sign out
          </button>
        )}
        {lastSyncedAt && (
          <p className="text-xs text-ink-400">
            Last synced: {new Date(lastSyncedAt).toLocaleString()}
          </p>
        )}
        {syncStatus === 'error' && (
          <p className="text-xs text-red-400">Something went wrong talking to Drive. Try again.</p>
        )}
      </section>

      {confirmLoad && (
        <ConfirmDialog
          title="Load from Drive?"
          message="This replaces the shows on this device with whatever was last saved to Drive. Anything tracked here since then that hasn't been saved will be lost."
          actions={[
            { label: 'Load from Drive', onClick: confirmAndLoad, variant: 'danger' },
          ]}
          onDismiss={() => setConfirmLoad(false)}
        />
      )}

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
              {formatWatchTimeAs(stats.totalMinutesWatched, watchTimeUnit)}
            </p>
            <p className="text-xs text-ink-400">
              spent watching {stats.totalEpisodesWatched} episode
              {stats.totalEpisodesWatched === 1 ? '' : 's'}
            </p>
            <div className="mt-3 flex gap-1.5 overflow-x-auto">
              {WATCH_TIME_UNITS.map((unit) => (
                <button
                  key={unit.value}
                  onClick={() => setWatchTimeUnit(unit.value)}
                  className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    watchTimeUnit === unit.value
                      ? 'bg-signal-500 text-ink-950'
                      : 'border border-ink-700 text-ink-400 hover:border-ink-600 hover:text-ink-200'
                  }`}
                >
                  {unit.label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-4 border-t border-ink-800 pt-3 text-xs text-ink-300">
              <span>{stats.showsWatching} watching</span>
              <span>{stats.showsCompleted} completed</span>
              <span>{stats.showsOnWatchlist} watchlist</span>
            </div>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400">Data</h2>
        <p className="text-xs text-ink-400">
          Your data lives on this device — no account needed. Use the Drive
          sync buttons above whenever you want to back it up or bring it to
          another device, via a hidden folder in your Drive that only this
          app can read; you'll need to sign in again each time you come
          back, it won't stay logged in. Use export/import below to back it
          up or move it manually either way.
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
