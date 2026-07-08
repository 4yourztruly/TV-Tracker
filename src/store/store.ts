import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import type { EpisodeInfo, SearchResult, TrackedShow } from '../types/show';
import { CURRENT_EPISODES_VERSION } from '../types/show';
import { deriveStatus, getNextEpisode, getLastWatchedEpisode, toggleEpisodeWatched, toggleSeasonWatched, markEpisodeAndPriorWatched, incrementEpisodeWatchCount, setEpisodeWatchCount } from '../utils/progress';
import { migrateLegacyTrackerData } from '../utils/migrateLegacyData';

export type Tab = 'home' | 'search' | 'settings';
export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

interface AppState {
  // --- auth (never persisted — see partialize below) ---
  isSignedIn: boolean;
  setSignedIn: (signedIn: boolean) => void;
  isGoogleAuthReady: boolean;
  setGoogleAuthReady: (ready: boolean) => void;
  /** Set right before triggering a Google sign-in from one of the two
   * explicit Drive buttons in Settings, so that once the token comes
   * back we know which action to run (save vs. load) instead of
   * guessing or running both. Cleared as soon as it's consumed. Never
   * persisted — it's meaningless across a reload. */
  pendingSyncAction: 'save' | 'load' | null;
  setPendingSyncAction: (action: 'save' | 'load' | null) => void;

  // --- shows ---
  shows: TrackedShow[];
  addShow: (show: TrackedShow) => void;
  removeShow: (id: string) => void;
  toggleEpisode: (id: string, season: number, episode: number) => void;
  markEpisodeAndPriorWatched: (id: string, season: number, episode: number) => void;
  rewatchEpisode: (id: string, season: number, episode: number) => void;
  toggleSeason: (id: string, season: number) => void;
  cacheSeasonEpisodes: (id: string, season: number, episodes: EpisodeInfo[]) => void;
  updateSeriesStatus: (id: string, seriesStatus: TrackedShow['seriesStatus']) => void;
  backfillGenres: (id: string, genres: string[]) => void;
  backfillImdbRating: (id: string, imdbRating: string | null) => void;
  backfillAgeRating: (id: string, ageRating: string | null) => void;
  backfillBackdrops: (id: string, backdropUrls: string[]) => void;
  backfillYears: (id: string, startYear: string | null, endYear: string | null) => void;
  backfillRelatedShows: (id: string, relatedShows: SearchResult[]) => void;
  markNextEpisodeWatched: (id: string) => void;
  unwatchLastEpisode: (id: string) => void;
  /** Which show/episode the Home screen's Watch History was last
   * pointed at, so ShowDetailScreen can jump straight to that episode
   * (auto-expand its season, scroll it into view) instead of just
   * opening the show. Consumed once by ShowDetailScreen on mount, then
   * cleared — never persisted, it's meaningless across a reload. */
  pendingEpisodeFocus: { season: number; episode: number } | null;
  setPendingEpisodeFocus: (focus: { season: number; episode: number } | null) => void;
  setShowStatus: (id: string, status: TrackedShow['status']) => void;
  setShowNotes: (id: string, notes: string) => void;
  replaceAllShows: (shows: TrackedShow[]) => void; // used by import

  // --- ui ---
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  /** Bumped whenever the user taps the Search tab's icon while already
   * on the Search tab — SearchScreen watches this to clear its query
   * back to the default Top Rated browse view, the same way a fresh
   * "go to search" tap would land. */
  searchResetToken: number;
  resetSearchTab: () => void;
  selectedShowId: string | null;
  setSelectedShow: (id: string | null) => void;
  /** A show whose details are being viewed from the Search tab but that
   * hasn't been added to the tracker yet. Kept separate from `shows` so
   * browsing details never accidentally persists/syncs an unadded show. */
  previewShow: TrackedShow | null;
  setPreviewShow: (show: TrackedShow | null) => void;

  // --- drive sync bookkeeping ---
  driveFileId: string | null;
  setDriveFileId: (id: string | null) => void;
  lastSyncedAt: number | null;
  setLastSyncedAt: (ts: number | null) => void;
  syncStatus: SyncStatus;
  setSyncStatus: (status: SyncStatus) => void;

  // --- home screen display preference ---
  /** 'list' is the grouped, detail-row layout; 'grid' is the
   * posters-only layout with a progress bar per poster. Persisted as a
   * plain display preference (not a credential). */
  homeViewMode: 'list' | 'grid';
  setHomeViewMode: (mode: 'list' | 'grid') => void;

  /** When true, the Home screen shows only the "Watching" section —
   * Watchlist, Up to date, and Completed are hidden. A display
   * preference the user can flip in Settings so a long completed
   * history doesn't clutter the home screen. Applies to both list and
   * grid layouts. */
  onlyShowWatching: boolean;
  setOnlyShowWatching: (only: boolean) => void;

  /** Whether the Home screen shows the Watch History section (most-
   * recently-watched shows/episodes first, above Watching). A display
   * preference toggled in Settings. */
  showWatchHistory: boolean;
  setShowWatchHistory: (show: boolean) => void;
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
function applyWatchedChange(show: TrackedShow, watchedEpisodes: Record<string, number>): TrackedShow {
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
      pendingSyncAction: null,
      setPendingSyncAction: (action) => set({ pendingSyncAction: action }),

      shows: [],
      addShow: (show) => set((s) => ({ shows: [...s.shows, show], previewShow: null })),
      removeShow: (id) => set((s) => ({ shows: s.shows.filter((sh) => sh.id !== id) })),

      toggleEpisode: (id, season, episode) =>
        set((s) => ({
          shows: s.shows.map((sh) =>
            sh.id === id ? applyWatchedChange(sh, toggleEpisodeWatched(sh, season, episode)) : sh
          ),
        })),

      markEpisodeAndPriorWatched: (id, season, episode) =>
        set((s) => ({
          shows: s.shows.map((sh) =>
            sh.id === id
              ? applyWatchedChange(sh, markEpisodeAndPriorWatched(sh, season, episode))
              : sh
          ),
        })),

      rewatchEpisode: (id, season, episode) =>
        set((s) => ({
          shows: s.shows.map((sh) =>
            sh.id === id
              ? applyWatchedChange(sh, incrementEpisodeWatchCount(sh, season, episode))
              : sh
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
                    seasonInfo.season === season
                      ? { ...seasonInfo, episodes, episodesVersion: CURRENT_EPISODES_VERSION }
                      : seasonInfo
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

      // One-time backfill for shows tracked before `genres` existed on
      // TrackedShow. Always sets it (even to []) so a show with
      // genuinely no genres from its source is marked "checked" and
      // isn't re-fetched forever.
      backfillGenres: (id, genres) =>
        set((s) => ({
          shows: s.shows.map((sh) => (sh.id === id ? touch({ ...sh, genres }) : sh)),
        })),

      // Same one-time-backfill pattern as genres, for shows tracked
      // before `imdbRating` was cached on TrackedShow instead of being
      // re-fetched from OMDb on every view.
      backfillImdbRating: (id, imdbRating) =>
        set((s) => ({
          shows: s.shows.map((sh) => (sh.id === id ? touch({ ...sh, imdbRating }) : sh)),
        })),

      // Same one-time-backfill pattern, for shows tracked before
      // `ageRating` was cached on TrackedShow.
      backfillAgeRating: (id, ageRating) =>
        set((s) => ({
          shows: s.shows.map((sh) => (sh.id === id ? touch({ ...sh, ageRating }) : sh)),
        })),

      // Same one-time-backfill pattern, for shows tracked before
      // `backdropUrls` was cached on TrackedShow.
      backfillBackdrops: (id, backdropUrls) =>
        set((s) => ({
          shows: s.shows.map((sh) => (sh.id === id ? touch({ ...sh, backdropUrls }) : sh)),
        })),

      // Same one-time-backfill pattern, for shows tracked before
      // `startYear`/`endYear` were cached on TrackedShow.
      backfillYears: (id, startYear, endYear) =>
        set((s) => ({
          shows: s.shows.map((sh) => (sh.id === id ? touch({ ...sh, startYear, endYear }) : sh)),
        })),

      // Same one-time-backfill pattern, for shows tracked before
      // `relatedShows` was cached on TrackedShow.
      backfillRelatedShows: (id, relatedShows) =>
        set((s) => ({
          shows: s.shows.map((sh) => (sh.id === id ? touch({ ...sh, relatedShows }) : sh)),
        })),

      // Quick-action from the home screen card: marks whatever the
      // currently-shown "next episode" is as watched. The only action
      // that appends to Watch History — episode/season toggles from
      // the detail screen deliberately don't, so History only ever
      // shows episodes actually watched via the home screen.
      markNextEpisodeWatched: (id) =>
        set((s) => ({
          shows: s.shows.map((sh) => {
            if (sh.id !== id) return sh;
            const next = getNextEpisode(sh);
            if (!next) return sh;
            const updated = applyWatchedChange(sh, toggleEpisodeWatched(sh, next.season, next.episode));
            return {
              ...updated,
              watchHistory: [
                ...(sh.watchHistory ?? []),
                { season: next.season, episode: next.episode, watchedAt: Date.now() },
              ],
            };
          }),
        })),

      // Swipe-to-unwatch quick action from the home screen card: undoes
      // whichever episode was most recently marked watched (mirrors
      // markNextEpisodeWatched, just in reverse) — including removing
      // its Watch History entry, since it's no longer actually watched.
      unwatchLastEpisode: (id) =>
        set((s) => ({
          shows: s.shows.map((sh) => {
            if (sh.id !== id) return sh;
            const last = getLastWatchedEpisode(sh);
            if (!last) return sh;
            const updated = applyWatchedChange(
              sh,
              setEpisodeWatchCount(sh, last.season, last.episode, 0)
            );
            return {
              ...updated,
              watchHistory: (sh.watchHistory ?? []).filter(
                (h) => !(h.season === last.season && h.episode === last.episode)
              ),
            };
          }),
        })),

      pendingEpisodeFocus: null,
      setPendingEpisodeFocus: (focus) => set({ pendingEpisodeFocus: focus }),

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
      searchResetToken: 0,
      resetSearchTab: () => set((s) => ({ searchResetToken: s.searchResetToken + 1 })),
      selectedShowId: null,
      setSelectedShow: (id) => set({ selectedShowId: id }),
      previewShow: null,
      setPreviewShow: (show) => set({ previewShow: show }),

      driveFileId: null,
      setDriveFileId: (id) => set({ driveFileId: id }),
      lastSyncedAt: null,
      setLastSyncedAt: (ts) => set({ lastSyncedAt: ts }),
      syncStatus: 'idle',
      setSyncStatus: (status) => set({ syncStatus: status }),

      homeViewMode: 'list',
      setHomeViewMode: (mode) => set({ homeViewMode: mode }),

      onlyShowWatching: false,
      setOnlyShowWatching: (only) => set({ onlyShowWatching: only }),

      showWatchHistory: true,
      setShowWatchHistory: (show) => set({ showWatchHistory: show }),
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
        homeViewMode: state.homeViewMode,
        onlyShowWatching: state.onlyShowWatching,
        showWatchHistory: state.showWatchHistory,
      }),
      // Bumped for the watchedEpisodes migration — upgrades anyone
      // rehydrating from an older locally-persisted copy.
      version: 1,
      migrate: (persistedState) => migrateLegacyTrackerData(persistedState as { shows?: unknown }),
    }
  )
);
