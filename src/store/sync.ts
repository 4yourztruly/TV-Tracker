import { useAppStore } from './store';
import { findOrCreateFile, readTrackerData, saveTrackerData } from '../api/drive';
import { computeWatchStats } from '../utils/stats';
import type { TrackerData } from '../types/show';

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/** Stamps both "last synced at" and the episodes-watched snapshot used
 * to derive "episodes watched since last resync" in Settings. Always
 * called together so the two never drift out of step. Re-reads state
 * fresh rather than trusting a caller's possibly-stale `store` snapshot,
 * since this runs after mutations like `replaceAllShows`. */
function markSynced() {
  const fresh = useAppStore.getState();
  fresh.setLastSyncedAt(Date.now());
  fresh.setEpisodesWatchedAtLastSync(computeWatchStats(fresh.shows).totalEpisodesWatched);
}

/** Loads tracker data from Drive on sign-in and hydrates the store. Call
 * this once right after a successful sign-in. */
export async function loadFromDrive() {
  const store = useAppStore.getState();
  store.setSyncStatus('syncing');
  try {
    // Always looked up fresh rather than trusting a previously cached
    // file id — that id would only be valid for whichever account was
    // signed in before, and reusing it here could load the wrong
    // account's data (or fail outright).
    const fileId = await findOrCreateFile();
    store.setDriveFileId(fileId);
    const data = await readTrackerData(fileId);

    if (data.shows.length === 0 && store.shows.length > 0) {
      // This account's Drive file is empty but there's already local
      // data (e.g. the user tracked shows before ever signing in).
      // Treat local as the source of truth and push it up, rather than
      // wiping it with the empty file we just read.
      syncToDrive();
    } else {
      store.replaceAllShows(data.shows);
      // Pushes any in-memory legacy-data migration back to Drive right
      // away, so it's a one-time cost rather than repeating.
      syncToDrive();
    }

    markSynced();
    store.setSyncStatus('idle');
  } catch (err) {
    console.error('Failed to load from Drive:', err);
    store.setSyncStatus('error');
  }
}

/** Immediately (no debounce) pushes current store state to Drive,
 * finding/creating the app's Drive file first if this session doesn't
 * already have one cached. This is what the explicit "Save to Drive"
 * button in Settings calls — it's a deliberate, user-initiated push,
 * not a background side-effect of some other action. */
export async function saveToDriveNow() {
  const store = useAppStore.getState();
  store.setSyncStatus('syncing');
  try {
    let fileId = store.driveFileId;
    if (!fileId) {
      fileId = await findOrCreateFile();
      store.setDriveFileId(fileId);
    }
    const data: TrackerData = { version: 1, shows: store.shows };
    await saveTrackerData(fileId, data);
    markSynced();
    store.setSyncStatus('idle');
  } catch (err) {
    console.error('Failed to save to Drive:', err);
    store.setSyncStatus('error');
  }
}

/** Debounced push of current store state to Drive. Call this after any
 * mutating action (add show, mark watched, edit progress, etc). Multiple
 * rapid calls collapse into a single write ~1s after the last one. */
export function syncToDrive() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    const store = useAppStore.getState();
    if (!store.driveFileId) return; // not signed in / not initialized yet
    store.setSyncStatus('syncing');
    try {
      const data: TrackerData = { version: 1, shows: store.shows };
      await saveTrackerData(store.driveFileId, data);
      markSynced();
      store.setSyncStatus('idle');
    } catch (err) {
      console.error('Failed to sync to Drive:', err);
      store.setSyncStatus('error');
    }
  }, 1000);
}
