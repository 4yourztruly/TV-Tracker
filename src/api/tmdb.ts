import type { SearchResult, SeasonSummary, SeriesStatus } from '../types/show';

/**
 * TMDB (The Movie Database) — free API key, strong coverage of
 * mainstream, foreign, and licensed TV shows.
 *
 * The API key isn't a secret in the OAuth-client-secret sense (it'll be
 * visible in the built JS bundle regardless — normal for this kind of
 * public key), but it's still kept out of source control via an env var.
 */

const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY as string | undefined;
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w200';

function requireKey() {
  if (!TMDB_KEY) {
    throw new Error(
      'Missing VITE_TMDB_API_KEY. Add it to your .env file (see .env.example).'
    );
  }
}

export async function searchTmdb(query: string): Promise<SearchResult[]> {
  requireKey();
  const res = await fetch(
    `${TMDB_BASE}/search/tv?query=${encodeURIComponent(query)}&api_key=${TMDB_KEY}`
  );
  if (!res.ok) throw new Error(`TMDB search failed: ${res.status}`);
  const data = await res.json();
  return (data.results || []).map((r: any) => ({
    source: 'tmdb' as const,
    sourceId: r.id,
    title: r.name,
    posterUrl: r.poster_path ? `${TMDB_IMAGE_BASE}${r.poster_path}` : undefined,
    summary: r.overview || undefined,
    year: r.first_air_date ? r.first_air_date.slice(0, 4) : undefined,
  }));
}

export interface TmdbShowDetails {
  title: string;
  summary?: string;
  posterUrl?: string;
  totalEpisodes: number | null;
  seriesStatus: SeriesStatus;
  episodeRuntimeMinutes?: number;
  seasons: SeasonSummary[];
}

function mapTmdbSeriesStatus(status: string | undefined): SeriesStatus {
  if (status === 'Ended' || status === 'Canceled') return 'ended';
  if (status === 'Returning Series' || status === 'In Production' || status === 'Planned') {
    return 'ongoing';
  }
  return 'unknown';
}

/** Fetches show details plus per-season episode counts. TMDB requires a
 * separate call per season to get named episodes, so those are fetched
 * lazily (see getTmdbSeasonEpisodes) rather than all up front. */
export async function getTmdbShowDetails(showId: number): Promise<TmdbShowDetails> {
  requireKey();
  const res = await fetch(`${TMDB_BASE}/tv/${showId}?api_key=${TMDB_KEY}`);
  if (!res.ok) throw new Error(`TMDB show fetch failed: ${res.status}`);
  const data = await res.json();

  const seasons: SeasonSummary[] = (data.seasons || [])
    .filter((s: any) => s.season_number > 0) // skip "Specials" (season 0)
    .map((s: any) => ({
      season: s.season_number,
      episodeCount: s.episode_count,
    }));

  // episode_run_time is an array (runtime can vary/change over a show's
  // run); using the first reported value is a reasonable estimate.
  const episodeRuntimeMinutes: number | undefined =
    Array.isArray(data.episode_run_time) && data.episode_run_time.length > 0
      ? data.episode_run_time[0]
      : undefined;

  return {
    title: data.name,
    summary: data.overview || undefined,
    posterUrl: data.poster_path ? `${TMDB_IMAGE_BASE}${data.poster_path}` : undefined,
    totalEpisodes: typeof data.number_of_episodes === 'number' ? data.number_of_episodes : null,
    seriesStatus: mapTmdbSeriesStatus(data.status),
    episodeRuntimeMinutes,
    seasons,
  };
}

export async function getTmdbSeasonEpisodes(showId: number, season: number) {
  requireKey();
  const res = await fetch(
    `${TMDB_BASE}/tv/${showId}/season/${season}?api_key=${TMDB_KEY}`
  );
  if (!res.ok) throw new Error(`TMDB season fetch failed: ${res.status}`);
  const data = await res.json();
  return (data.episodes || []).map((e: any) => ({
    season,
    episode: e.episode_number,
    title: e.name,
    airdate: e.air_date,
    imageUrl: e.still_path ? `${TMDB_IMAGE_BASE}${e.still_path}` : undefined,
  }));
}
