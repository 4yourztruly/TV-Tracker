import type { TrackedShow, EpisodeInfo, WatchStatus } from '../types/show';

export function episodeKey(season: number, episode: number): string {
  return `${season}-${episode}`;
}

/** How many times a specific episode has been watched (0 = never). */
export function getEpisodeWatchCount(show: TrackedShow, season: number, episode: number): number {
  return show.watchedEpisodes[episodeKey(season, episode)] ?? 0;
}

export function isEpisodeWatched(show: TrackedShow, season: number, episode: number): boolean {
  return getEpisodeWatchCount(show, season, episode) > 0;
}

/** Number of distinct episodes watched at least once (rewatches don't
 * change this — watching S1E1 three times still counts as 1 here). */
export function getWatchedEpisodeCount(show: TrackedShow): number {
  return Object.values(show.watchedEpisodes).filter((count) => count > 0).length;
}

/** Total watch instances across all episodes, including rewatches —
 * e.g. one episode watched 3 times plus another watched once is 4.
 * This is what watch-time stats should be based on. */
export function getTotalWatchInstances(show: TrackedShow): number {
  return Object.values(show.watchedEpisodes).reduce((sum, count) => sum + Math.max(count, 0), 0);
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

/** The most recently watched episode in sequential order, or null if
 * nothing has been watched yet. Used to undo the home screen's "mark
 * next episode watched" quick action via a swipe gesture. */
export function getLastWatchedEpisode(show: TrackedShow): EpisodeInfo | null {
  const order = allEpisodesInOrder(show);
  for (let i = order.length - 1; i >= 0; i--) {
    if (isEpisodeWatched(show, order[i].season, order[i].episode)) {
      return order[i];
    }
  }
  return null;
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

/** Sets an episode's watch count directly. A count of 0 (or less)
 * removes it from the map entirely — same as never having watched it —
 * rather than leaving a stray zero entry around. */
export function setEpisodeWatchCount(
  show: TrackedShow,
  season: number,
  episode: number,
  count: number
): Record<string, number> {
  const key = episodeKey(season, episode);
  const updated = { ...show.watchedEpisodes };
  if (count <= 0) {
    delete updated[key];
  } else {
    updated[key] = count;
  }
  return updated;
}

/** Marks an episode as watched (count 1) or removes it (count 0),
 * independent of any other episode — checking S2E12 does NOT also
 * check S2E1-E11. Used for the simple "just this one" case; if the
 * episode is already watched one or more times, this resets it to 1
 * rather than incrementing — use incrementEpisodeWatchCount for
 * rewatches. */
export function toggleEpisodeWatched(
  show: TrackedShow,
  season: number,
  episode: number
): Record<string, number> {
  const watched = isEpisodeWatched(show, season, episode);
  return setEpisodeWatchCount(show, season, episode, watched ? 0 : 1);
}

/** Adds one more watch to an episode already marked watched (2x, 3x,
 * ...) — used when the user chooses "watch again" on an episode they've
 * already seen. */
export function incrementEpisodeWatchCount(
  show: TrackedShow,
  season: number,
  episode: number
): Record<string, number> {
  const current = getEpisodeWatchCount(show, season, episode);
  return setEpisodeWatchCount(show, season, episode, current + 1);
}

/** Are there any unwatched episodes strictly before this one in
 * sequential order? Used to decide whether marking an episode watched
 * should prompt "mark everything before it too, or just this one." */
export function hasUnwatchedEpisodesBefore(
  show: TrackedShow,
  season: number,
  episode: number
): boolean {
  const order = allEpisodesInOrder(show);
  const idx = order.findIndex((e) => e.season === season && e.episode === episode);
  if (idx <= 0) return false;
  return order.slice(0, idx).some((e) => !isEpisodeWatched(show, e.season, e.episode));
}

/** Marks this episode and every earlier unwatched episode as watched
 * (count 1 each). Episodes already watched (including rewatched ones)
 * are left exactly as they were — this only fills in gaps, it never
 * resets an existing rewatch count. */
export function markEpisodeAndPriorWatched(
  show: TrackedShow,
  season: number,
  episode: number
): Record<string, number> {
  const order = allEpisodesInOrder(show);
  const idx = order.findIndex((e) => e.season === season && e.episode === episode);
  const updated = { ...show.watchedEpisodes };
  for (let i = 0; i <= idx; i++) {
    const key = episodeKey(order[i].season, order[i].episode);
    if (!updated[key]) updated[key] = 1;
  }
  return updated;
}

/** Toggles an entire season at once: if every episode in the season is
 * already watched, unchecks all of them; otherwise marks all
 * not-yet-watched ones watched (count 1). Already-watched episodes'
 * rewatch counts are left untouched either way. Other seasons are
 * untouched. */
export function toggleSeasonWatched(show: TrackedShow, season: number): Record<string, number> {
  const seasonInfo = show.seasons.find((s) => s.season === season);
  if (!seasonInfo) return show.watchedEpisodes;

  const seasonKeys = Array.from({ length: seasonInfo.episodeCount }, (_, i) =>
    episodeKey(season, i + 1)
  );
  const allWatched = seasonKeys.every((k) => (show.watchedEpisodes[k] ?? 0) > 0);

  const updated = { ...show.watchedEpisodes };
  if (allWatched) {
    seasonKeys.forEach((k) => delete updated[k]);
  } else {
    seasonKeys.forEach((k) => {
      if (!updated[k]) updated[k] = 1;
    });
  }
  return updated;
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
