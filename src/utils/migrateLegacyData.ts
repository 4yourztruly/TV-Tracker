import type { TrackedShow } from '../types/show';

/**
 * One-time migrations for shows written by older versions of the app.
 * Two legacy shapes are handled, and both funnel into the current
 * `watchedEpisodes: Record<string, number>` (watch count per episode)
 * shape:
 *
 *  1. Oldest: a single `lastWatchedSeason`/`lastWatchedEpisode` pointer
 *     instead of any per-episode tracking at all.
 *  2. Middle: `watchedEpisodes` as a plain string array (a watched
 *     set, no rewatch counts) instead of today's count map.
 *
 * Safe to run on any tracker data, migrated or not — already-migrated
 * shows pass through untouched.
 */

interface LegacyTrackedShow {
  lastWatchedSeason?: number;
  lastWatchedEpisode?: number;
  watchedEpisodes?: unknown;
  seasons?: { season: number; episodeCount: number }[];
  [key: string]: unknown;
}

function isPointerLegacyShow(show: unknown): show is LegacyTrackedShow {
  if (typeof show !== 'object' || show === null) return false;
  const s = show as Record<string, unknown>;
  // Already has some watchedEpisodes representation (array or map) —
  // not the oldest pointer-only shape.
  if (s.watchedEpisodes !== undefined) return false;
  return typeof s.lastWatchedSeason === 'number' || typeof s.lastWatchedEpisode === 'number';
}

function isArrayLegacyShow(
  show: unknown
): show is LegacyTrackedShow & { watchedEpisodes: unknown[] } {
  if (typeof show !== 'object' || show === null) return false;
  return Array.isArray((show as Record<string, unknown>).watchedEpisodes);
}

/** Converts a pointer-legacy show into the current shape: everything
 * at or before the old pointer is marked watched once, everything
 * after is not. */
function migratePointerShow(show: LegacyTrackedShow): TrackedShow {
  const lastSeason = show.lastWatchedSeason ?? 0;
  const lastEpisode = show.lastWatchedEpisode ?? 0;
  const seasons = Array.isArray(show.seasons) ? show.seasons : [];

  const watchedEpisodes: Record<string, number> = {};
  for (const s of seasons) {
    if (s.season < lastSeason) {
      for (let ep = 1; ep <= s.episodeCount; ep++) {
        watchedEpisodes[`${s.season}-${ep}`] = 1;
      }
    } else if (s.season === lastSeason) {
      const upTo = Math.min(lastEpisode, s.episodeCount);
      for (let ep = 1; ep <= upTo; ep++) {
        watchedEpisodes[`${s.season}-${ep}`] = 1;
      }
    }
  }

  const { lastWatchedSeason, lastWatchedEpisode, ...rest } = show;
  void lastWatchedSeason;
  void lastWatchedEpisode;
  return { ...(rest as unknown as TrackedShow), watchedEpisodes };
}

/** Converts an array-legacy show (plain watched set, no rewatch
 * counts) into the current count-map shape — each previously-watched
 * episode starts at a count of 1. */
function migrateArrayShow(show: LegacyTrackedShow & { watchedEpisodes: unknown[] }): TrackedShow {
  const watchedEpisodes: Record<string, number> = {};
  for (const key of show.watchedEpisodes) {
    if (typeof key === 'string') watchedEpisodes[key] = 1;
  }
  return { ...(show as unknown as TrackedShow), watchedEpisodes };
}

/** Migrates a whole tracker payload (anything shaped like `{ shows: [...] }`
 * — covers both the Drive blob and the local persisted store state).
 * Returns the same reference if nothing needed migrating. */
export function migrateLegacyTrackerData<T extends { shows?: unknown }>(data: T): T {
  if (typeof data !== 'object' || data === null || !Array.isArray(data.shows)) {
    return data;
  }

  let migratedCount = 0;
  const shows = data.shows.map((show: unknown) => {
    if (isPointerLegacyShow(show)) {
      migratedCount += 1;
      return migratePointerShow(show);
    }
    if (isArrayLegacyShow(show)) {
      migratedCount += 1;
      return migrateArrayShow(show);
    }
    return show;
  });

  if (migratedCount === 0) return data;

  console.info(
    `[migration] Converted ${migratedCount} show(s) to the current watchedEpisodes watch-count format.`
  );
  return { ...data, shows };
}
