import type { TrackedShow, EpisodeInfo, WatchStatus } from '../types/show';

export function episodeKey(season: number, episode: number): string {
  return `${season}-${episode}`;
}

export function isEpisodeWatched(show: TrackedShow, season: number, episode: number): boolean {
  return show.watchedEpisodes.includes(episodeKey(season, episode));
}

/** Total number of individually watched episodes. */
export function getWatchedEpisodeCount(show: TrackedShow): number {
  return show.watchedEpisodes.length;
}

/** All episodes across all known seasons, in season/episode order. Used
 * to find "the next unwatched one" without needing every season's
 * named-episode list already loaded — season summaries (counts) are
 * enough. */
function allEpisodesInOrder(show: TrackedShow): Array<{ season: number; episode: number }> {
  const result: Array<{ season: number; episode: number }> = [];
  for (const s of [...show.seasons].sort((a, b) => a.season - b.season)) {
    for (let ep = 1; ep <= s.episodeCount; ep++) {
      result.push({ season: s.season, episode: ep });
    }
  }
  return result;
}

/** The first unwatched episode in sequential order, or null if every
 * known episode has been watched (or the show is marked completed). */
export function getNextEpisode(show: TrackedShow): EpisodeInfo | null {
  if (show.status === 'completed') return null;
  const next = allEpisodesInOrder(show).find(
    (e) => !isEpisodeWatched(show, e.season, e.episode)
  );
  return next ?? null;
}

/** Episodes remaining AFTER the "next" episode shown on the home
 * screen (i.e. not counting that one). Returns null if the total
 * episode count is unknown. */
export function getEpisodesLeft(show: TrackedShow): number | null {
  if (show.totalEpisodes == null) return null;
  const watched = getWatchedEpisodeCount(show);
  const next = getNextEpisode(show);
  return Math.max(show.totalEpisodes - watched - (next ? 1 : 0), 0);
}

export function hasWatchedAllKnownEpisodes(show: TrackedShow): boolean {
  return show.totalEpisodes != null && getWatchedEpisodeCount(show) >= show.totalEpisodes;
}

export function isShowUpToDate(show: TrackedShow): boolean {
  return (
    show.seriesStatus === 'ongoing' &&
    (show.status === 'completed' || hasWatchedAllKnownEpisodes(show))
  );
}

/** Suggests a status from watched progress alone. The store keeps
 * `status` as an explicit field (so users can manually override, e.g.
 * mark complete despite a stale episode count from the API), but calls
 * this to auto-advance status whenever watched episodes change. */
export function deriveStatus(show: TrackedShow): WatchStatus {
  const watched = getWatchedEpisodeCount(show);
  if (watched === 0) return 'unwatched';
  if (hasWatchedAllKnownEpisodes(show)) return isShowUpToDate(show) ? 'watching' : 'completed';
  return 'watching';
}

/** Toggles a single episode's watched state, independent of any other
 * episode — checking S2E12 does NOT also check S2E1-E11. */
export function toggleEpisodeWatched(
  show: TrackedShow,
  season: number,
  episode: number
): string[] {
  const key = episodeKey(season, episode);
  if (show.watchedEpisodes.includes(key)) {
    return show.watchedEpisodes.filter((k) => k !== key);
  }
  return [...show.watchedEpisodes, key];
}

/** Toggles an entire season at once: if every episode in the season is
 * already watched, unchecks all of them; otherwise marks all of them
 * watched. Other seasons are untouched. */
export function toggleSeasonWatched(show: TrackedShow, season: number): string[] {
  const seasonInfo = show.seasons.find((s) => s.season === season);
  if (!seasonInfo) return show.watchedEpisodes;

  const seasonKeys = Array.from({ length: seasonInfo.episodeCount }, (_, i) =>
    episodeKey(season, i + 1)
  );
  const allWatched = seasonKeys.every((k) => show.watchedEpisodes.includes(k));

  if (allWatched) {
    return show.watchedEpisodes.filter((k) => !seasonKeys.includes(k));
  }
  const withoutSeason = show.watchedEpisodes.filter((k) => !seasonKeys.includes(k));
  return [...withoutSeason, ...seasonKeys];
}

export interface PosterProgress {
  /** 0–1 fill amount for the poster's progress bar. */
  fraction: number;
  /** purple = fully completed; green = caught up on an ongoing show;
   * yellow = partway through; none = nothing watched yet. */
  color: 'purple' | 'green' | 'yellow' | 'none';
}

/** Summarizes a show's watch progress for the grid view's poster bar.
 * Mirrors the same "completed vs. up to date vs. in progress" logic
 * ShowCard uses for its text label, just expressed as a fill + color. */
export function getPosterProgress(show: TrackedShow): PosterProgress {
  const upToDate = isShowUpToDate(show);
  const trulyCompleted = show.status === 'completed' && !upToDate;

  if (trulyCompleted) return { fraction: 1, color: 'purple' };
  if (upToDate) return { fraction: 1, color: 'green' };

  const watched = getWatchedEpisodeCount(show);
  if (watched === 0) return { fraction: 0, color: 'none' };

  if (show.totalEpisodes && show.totalEpisodes > 0) {
    return { fraction: Math.min(watched / show.totalEpisodes, 1), color: 'yellow' };
  }
  // Total episode count unknown (common for airing anime) — still show
  // a sliver so "started but total unknown" reads differently from
  // "nothing watched," without implying a fraction we don't actually know.
  return { fraction: 0.08, color: 'yellow' };
}

export function isSeasonFullyWatched(show: TrackedShow, season: number): boolean {
  const seasonInfo = show.seasons.find((s) => s.season === season);
  if (!seasonInfo || seasonInfo.episodeCount === 0) return false;
  for (let ep = 1; ep <= seasonInfo.episodeCount; ep++) {
    if (!isEpisodeWatched(show, season, ep)) return false;
  }
  return true;
}
