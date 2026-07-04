import type { TrackedShow } from '../types/show';

/**
 * One-time migration for shows written by the pre-`watchedEpisodes`
 * version of the app, which tracked progress as a single
 * `lastWatchedSeason`/`lastWatchedEpisode` pointer instead of a set of
 * individually watched episodes. Safe to run on any tracker data,
 * migrated or not — already-migrated shows pass through untouched.
 */

interface LegacyTrackedShow {
  lastWatchedSeason?: number;
  lastWatchedEpisode?: number;
  watchedEpisodes?: unknown;
  seasons?: { season: number; episodeCount: number }[];
  [key: string]: unknown;
}

function isLegacyShow(show: unknown): show is LegacyTrackedShow {
  if (typeof show !== 'object' || show === null) return false;
  const s = show as Record<string, unknown>;
  if (Array.isArray(s.watchedEpisodes)) return false;
  return typeof s.lastWatchedSeason === 'number' || typeof s.lastWatchedEpisode === 'number';
}

/** Converts one legacy show into the current shape: everything at or
 * before the old pointer is marked watched, everything after is not. */
function migrateShow(show: LegacyTrackedShow): TrackedShow {
  const lastSeason = show.lastWatchedSeason ?? 0;
  const lastEpisode = show.lastWatchedEpisode ?? 0;
  const seasons = Array.isArray(show.seasons) ? show.seasons : [];

  const watchedEpisodes: string[] = [];
  for (const s of seasons) {
    if (s.season < lastSeason) {
      for (let ep = 1; ep <= s.episodeCount; ep++) {
        watchedEpisodes.push(`${s.season}-${ep}`);
      }
    } else if (s.season === lastSeason) {
      const upTo = Math.min(lastEpisode, s.episodeCount);
      for (let ep = 1; ep <= upTo; ep++) {
        watchedEpisodes.push(`${s.season}-${ep}`);
      }
    }
  }

  const { lastWatchedSeason, lastWatchedEpisode, ...rest } = show;
  void lastWatchedSeason;
  void lastWatchedEpisode;
  return { ...(rest as unknown as TrackedShow), watchedEpisodes };
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
    if (isLegacyShow(show)) {
      migratedCount += 1;
      return migrateShow(show);
    }
    return show;
  });

  if (migratedCount === 0) return data;

  console.info(
    `[migration] Converted ${migratedCount} show(s) from the legacy lastWatchedSeason/lastWatchedEpisode pointer to watchedEpisodes.`
  );
  return { ...data, shows };
}
