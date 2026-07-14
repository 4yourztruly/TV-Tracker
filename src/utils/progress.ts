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

/** The episode from the most recent Watch History entry — i.e.
 * whatever markNextEpisodeWatched most recently marked via the Home
 * screen's quick-watch action — or null if there isn't one. Used to
 * undo that action via the home screen's swipe-to-unwatch gesture.
 * Deliberately watch-history-based rather than "sequentially last
 * watched episode overall": an episode marked out of order from the
 * detail screen (e.g. "just this one" while earlier episodes are still
 * unwatched) would otherwise get silently unwatched by a swipe meant to
 * undo a completely different, more recent home-screen action. */
export function getLastWatchedEpisode(show: TrackedShow): EpisodeInfo | null {
  const history = show.watchHistory;
  if (!history || history.length === 0) return null;
  return history.reduce((latest, h) => (h.watchedAt > latest.watchedAt ? h : latest));
}

/** Timestamp of the most recent Watch History entry (i.e. the last time
 * an episode was marked watched via the Home screen's quick-watch
 * action), or null if there isn't one. Detail-screen toggles don't
 * append to Watch History, so they don't count here either — this is
 * specifically "most recently watched via Home." Used to order the
 * Home screen's Watching section by recency; unwatching removes the
 * corresponding Watch History entry (see unwatchLastEpisode), so it
 * naturally falls back to whatever's next most recent instead of still
 * counting as "just watched." */
export function getLastWatchedAt(show: TrackedShow): number | null {
  const history = show.watchHistory;
  if (!history || history.length === 0) return null;
  return Math.max(...history.map((h) => h.watchedAt));
}

/** Total episodes across all *known* seasons — the same enumerable list
 * `getNextEpisode`/`allEpisodesInOrder` walk. Deliberately not
 * `show.totalEpisodes`: that's a separately-sourced API aggregate (TMDB's
 * own `number_of_episodes`) that can drift out of sync with the actual
 * per-season episode lists — e.g. a newly announced season TMDB lists
 * with 0 known episodes yet shouldn't block "up to date" just because
 * the aggregate hasn't caught up (or has already counted it). */
export function getTotalKnownEpisodes(show: TrackedShow): number {
  return show.seasons.reduce((sum, s) => sum + s.episodeCount, 0);
}

/** Episodes remaining AFTER the "next" episode shown on the home
 * screen (i.e. not counting that one). Returns null if there are no
 * known episodes at all yet. */
export function getEpisodesLeft(show: TrackedShow): number | null {
  const total = getTotalKnownEpisodes(show);
  if (total === 0) return null;
  const watched = getWatchedEpisodeCount(show);
  const next = getNextEpisode(show);
  return Math.max(total - watched - (next ? 1 : 0), 0);
}

export function hasWatchedAllKnownEpisodes(show: TrackedShow): boolean {
  const total = getTotalKnownEpisodes(show);
  return total > 0 && getWatchedEpisodeCount(show) >= total;
}

export function isShowUpToDate(show: TrackedShow): boolean {
  return (
    show.seriesStatus === 'ongoing' &&
    (show.status === 'completed' || hasWatchedAllKnownEpisodes(show))
  );
}

/** Re-derives status from watched progress, but ONLY ever forces the
 * *completed* classification on or off — "Watching" vs. "Watchlist" is
 * otherwise left exactly as it was (whatever the user last set via the
 * status picker, or the 'unwatched' default a show starts with), never
 * auto-promoted just because some episodes got checked off. A show
 * only ever lands in Watching because the user put it there themselves;
 * Completed/Up to date is the one classification the app decides on
 * its own, the moment every known episode is watched. */
export function deriveStatus(show: TrackedShow): WatchStatus {
  if (hasWatchedAllKnownEpisodes(show)) return 'completed';
  // No longer fully watched (e.g. an episode got unwatched) — falls
  // back to 'watching' rather than staying 'completed', since there's
  // no prior non-completed status to restore.
  return show.status === 'completed' ? 'watching' : show.status;
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

  const totalKnown = getTotalKnownEpisodes(show);
  if (totalKnown > 0) {
    return { fraction: Math.min(watched / totalKnown, 1), color: 'yellow' };
  }
  // No known episodes yet (common for airing anime right after it's
  // announced) — still show a sliver so "started but total unknown"
  // reads differently from "nothing watched," without implying a
  // fraction we don't actually know.
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
