import type { TrackedShow } from '../types/show';
import { getWatchedEpisodeCount } from './progress';

/** Used when a show's source API doesn't report an episode runtime
 * (TMDB's episode_run_time and Jikan's duration can both be missing).
 * 24 minutes is a reasonable general TV/anime episode average. */
const DEFAULT_RUNTIME_MINUTES = 24;

export interface WatchStats {
  totalEpisodesWatched: number;
  totalMinutesWatched: number;
  showsWatching: number;
  showsCompleted: number;
  showsOnWatchlist: number;
}

export function computeWatchStats(shows: TrackedShow[]): WatchStats {
  let totalEpisodesWatched = 0;
  let totalMinutesWatched = 0;
  let showsWatching = 0;
  let showsCompleted = 0;
  let showsOnWatchlist = 0;

  for (const show of shows) {
    const watched = getWatchedEpisodeCount(show);
    totalEpisodesWatched += watched;
    totalMinutesWatched += watched * (show.episodeRuntimeMinutes ?? DEFAULT_RUNTIME_MINUTES);

    if (show.status === 'watching') showsWatching += 1;
    else if (show.status === 'completed') showsCompleted += 1;
    else showsOnWatchlist += 1;
  }

  return { totalEpisodesWatched, totalMinutesWatched, showsWatching, showsCompleted, showsOnWatchlist };
}

function round(n: number): string {
  // Show one decimal place unless it's a whole number, to avoid
  // "2.0 years" style noise while still being precise for small counts.
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Formats a minute count into the largest sensible unit — minutes,
 * hours, days, months, or years — so the number stays readable no
 * matter how much someone has watched. */
export function formatWatchTime(totalMinutes: number): string {
  if (totalMinutes < 60) {
    return `${Math.round(totalMinutes)} minute${totalMinutes === 1 ? '' : 's'}`;
  }

  const hours = totalMinutes / 60;
  if (hours < 24) {
    return `${round(hours)} hour${hours === 1 ? '' : 's'}`;
  }

  const days = hours / 24;
  if (days < 30) {
    return `${round(days)} day${days === 1 ? '' : 's'}`;
  }

  const months = days / 30.44; // average month length
  if (months < 12) {
    return `${round(months)} month${months === 1 ? '' : 's'}`;
  }

  const years = days / 365.25;
  return `${round(years)} year${years === 1 ? '' : 's'}`;
}
