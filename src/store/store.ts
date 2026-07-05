import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import type { EpisodeInfo, TrackedShow } from '../types/show';
import { deriveStatus, getNextEpisode, toggleEpisodeWatched, toggleSeasonWatched } from '../utils/progress';
import { migrateLegacyTrackerData } from '../utils/migrateLegacyData';

export type Tab = 'home' | 'search' | 'settings';
export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

interface AppState {
  // --- auth (never persisted — see partialize below) ---
  isSignedIn: boolean;
  setSignedIn: (signedIn: boolean) => void;
  isGoogleAuthReady: boolean;
  setGoogleAuthReady: (ready: boolean) => void;

  // --- shows ---
  shows: TrackedShow[];
  addShow: (show: TrackedShow) => void;
  removeShow: (id: string) => void;
  toggleEpisode: (id: string, season: number, episode: number) => void;
  toggleSeason: (id: string, season: number) => void;
  cacheSeasonEpisodes: (id: string, season: number, episodes: EpisodeInfo[]) => void;
  updateSeriesStatus: (id: string, seriesStatus: TrackedShow['seriesStatus']) => void;
  markNextEpisodeWatched: (id: string) => void;
  setShowStatus: (id: string, status: TrackedShow['status']) => void;
  setShowNotes: (id: string, notes: string) => void;
  replaceAllShows: (shows: TrackedShow[]) => void; // used by import

  // --- ui ---
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  selectedShowId: string | null;
  setSelectedShow: (id: string | null) => void;
  /** A show whose details are being viewed from the Search tab but that
   * hasn't been added to the tracker yet. Kept separate from `shows` so
   * browsing details never accidentally persists/syncs an unadded show. */
  previewShow: TrackedShow | null;
  setPreviewShow: (show: TrackedShow | null) => void;

  // --- drive sync bookkeeping ---
  /** Whether the user has opted in to Google Drive sync. Persisted (it's
   * just a preference, not a credential) so the app can quietly try to
   * reconnect on future visits without the user having to click "Sign
   * in" every time — see trySilentSignIn in App.tsx. Only flipped by an
   * explicit sign-in/out action in Settings. */
  driveSyncEnabled: boolean;
  setDriveSyncEnabled: (enabled: boolean) => void;
  driveFileId: string | null;
  setDriveFileId: (id: string | null) => void;
  lastSyncedAt: number | null;
  setLastSyncedAt: (ts: number | null) => void;
  syncStatus: SyncStatus;
  setSyncStatus: (status: SyncStatus) => void;

  // --- home screen display preference ---
  /** 'list' is the grouped, detail-row layout; 'grid' is the
   * posters-only layout with a progress bar per poster. Persisted as a
   * plain display preference (not a credential), same as driveSyncEnabled. */
  homeViewMode: 'list' | 'grid';
  setHomeViewMode: (mode: 'list' | 'grid') => void;
}

// idb-keyval backed storage adapter so Zustand's persist middleware can
// use IndexedDB instead of localStorage (keeps larger show lists fast
// and off the more easily-XSS-readable localStorage/sessionStorage).
const idbStorage = {
  getItem: async (name: string) => (await idbGet(name)) ?? null,
  setItem: async (name: string, value: string) => idbSet(name, value),
  removeItem: async (name: string) => idbDel(name),
};

function touch(show: TrackedShow): TrackedShow {
  return { ...show, updatedAt: Date.now() };
}

/** Applies a watched-episode change and re-derives status from it. */
function applyWatchedChange(show: TrackedShow, watchedEpisodes: string[]): TrackedShow {
  const updated = touch({ ...show, watchedEpisodes });
  return { ...updated, status: deriveStatus(updated) };
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      isSignedIn: false,
      setSignedIn: (signedIn) => set({ isSignedIn: signedIn }),
      isGoogleAuthReady: false,
      setGoogleAuthReady: (ready) => set({ isGoogleAuthReady: ready }),

      shows: [],
      addShow: (show) => set((s) => ({ shows: [...s.shows, show], previewShow: null })),
      removeShow: (id) => set((s) => ({ shows: s.shows.filter((sh) => sh.id !== id) })),

      toggleEpisode: (id, season, episode) =>
        set((s) => ({
          shows: s.shows.map((sh) =>
            sh.id === id ? applyWatchedChange(sh, toggleEpisodeWatched(sh, season, episode)) : sh
          ),
        })),

      toggleSeason: (id, season) =>
        set((s) => ({
          shows: s.shows.map((sh) =>
            sh.id === id ? applyWatchedChange(sh, toggleSeasonWatched(sh, season)) : sh
          ),
        })),

      cacheSeasonEpisodes: (id, season, episodes) =>
        set((s) => ({
          shows: s.shows.map((sh) =>
            sh.id === id
              ? touch({
                  ...sh,
                  seasons: sh.seasons.map((seasonInfo) =>
                    seasonInfo.season === season ? { ...seasonInfo, episodes } : seasonInfo
                  ),
                })
              : sh
          ),
        })),

      updateSeriesStatus: (id, seriesStatus) =>
        set((s) => ({
          shows: s.shows.map((sh) =>
            sh.id === id
              ? touch({ ...sh, seriesStatus, seriesStatusUpdatedAt: Date.now(), seriesStatusVersion: 2 })
              : sh
          ),
        })),

      // Quick-action from the home screen card: marks whatever the
      // currently-shown "next episode" is as watched.
      markNextEpisodeWatched: (id) =>
        set((s) => ({
          shows: s.shows.map((sh) => {
            if (sh.id !== id) return sh;
            const next = getNextEpisode(sh);
            if (!next) return sh;
            return applyWatchedChange(sh, toggleEpisodeWatched(sh, next.season, next.episode));
          }),
        })),

      setShowStatus: (id, status) =>
        set((s) => ({
          shows: s.shows.map((sh) => (sh.id === id ? touch({ ...sh, status }) : sh)),
        })),

      setShowNotes: (id, notes) =>
        set((s) => ({
          shows: s.shows.map((sh) => (sh.id === id ? touch({ ...sh, notes }) : sh)),
        })),

      replaceAllShows: (shows) => set({ shows }),

      activeTab: 'home',
      setActiveTab: (tab) => set({ activeTab: tab }),
      selectedShowId: null,
      setSelectedShow: (id) => set({ selectedShowId: id }),
      previewShow: null,
      setPreviewShow: (show) => set({ previewShow: show }),

      driveSyncEnabled: false,
      setDriveSyncEnabled: (enabled) => set({ driveSyncEnabled: enabled }),
      driveFileId: null,
      setDriveFileId: (id) => set({ driveFileId: id }),
      lastSyncedAt: null,
      setLastSyncedAt: (ts) => set({ lastSyncedAt: ts }),
      syncStatus: 'idle',
      setSyncStatus: (status) => set({ syncStatus: status }),

      homeViewMode: 'list',
      setHomeViewMode: (mode) => set({ homeViewMode: mode }),
    }),
    {
      name: 'tv-tracker-storage',
      storage: createJSONStorage(() => idbStorage),
      // Deliberately exclude driveFileId: it's only valid for whichever
      // Google account is currently signed in, and persisting it across
      // reloads/accounts risks loading one account's data using another
      // account's cached file id. Every sign-in looks it up fresh
      // instead (see loadFromDrive), which is cheap and always correct.
      // Also excludes the access token (never stored here to begin
      // with — see api/auth.ts) and transient UI state.
      partialize: (state) => ({
        shows: state.shows,
        lastSyncedAt: state.lastSyncedAt,
        driveSyncEnabled: state.driveSyncEnabled,
        homeViewMode: state.homeViewMode,
      }),
      // Bumped for the watchedEpisodes migration — upgrades anyone
      // rehydrating from an older locally-persisted copy.
      version: 1,
      migrate: (persistedState) => migrateLegacyTrackerData(persistedState as { shows?: unknown }),
    }
  )
);
