import type { EpisodeInfo, SearchResult, ShowSource, SeasonSummary, SeriesStatus } from '../types/show';
import { searchTmdb, getTmdbShowDetails, getTmdbSeasonEpisodes, getTmdbRelatedShows } from './tmdb';
import { searchJikan, getJikanAnimeDetails, getJikanEpisodes, getJikanRelatedShows } from './jikan';

// In-memory only, per query string — search-as-you-type means the
// same text often gets searched again a moment later (backspacing
// and retyping, refocusing the field, ...); this just avoids re-
// hitting both APIs for a query already answered this session.
const searchCache = new Map<string, SearchResult[]>();

/** Runs both searches in parallel and merges results. If one source
 * fails (e.g. missing TMDB key), the other still returns results
 * rather than failing the whole search. */
export async function searchAll(query: string): Promise<SearchResult[]> {
  const cacheKey = query.trim().toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached) return cached;

  const [tmdbResult, jikanResult] = await Promise.allSettled([
    searchTmdb(query),
    searchJikan(query),
  ]);

  const results: SearchResult[] = [];
  if (tmdbResult.status === 'fulfilled') results.push(...tmdbResult.value);
  else console.warn('TMDB search failed:', tmdbResult.reason);

  if (jikanResult.status === 'fulfilled') results.push(...jikanResult.value);
  else console.warn('Jikan search failed:', jikanResult.reason);

  // Only cache when at least one source actually answered — don't
  // lock in an empty result set from a moment where both happened to
  // fail (e.g. Jikan's frequent rate-limit timeouts).
  if (tmdbResult.status === 'fulfilled' || jikanResult.status === 'fulfilled') {
    searchCache.set(cacheKey, results);
  }

  return results;
}

export interface ShowDetails {
  title: string;
  summary?: string;
  posterUrl?: string;
  totalEpisodes: number | null;
  seriesStatus: SeriesStatus;
  episodeRuntimeMinutes?: number;
  genres?: string[];
  ageRating?: string;
  backdropUrls?: string[];
  startYear?: string;
  endYear?: string;
  seasons: SeasonSummary[];
}

export async function getShowDetails(
  source: ShowSource,
  sourceId: number
): Promise<ShowDetails> {
  if (source === 'tmdb') return getTmdbShowDetails(sourceId);
  return getJikanAnimeDetails(sourceId);
}

/** Fetches the named episode list for a single season, dispatching to
 * the right source. Used lazily when a season is expanded in the UI. */
export async function getSeasonEpisodes(
  source: ShowSource,
  sourceId: number,
  season: number
): Promise<EpisodeInfo[]> {
  if (source === 'tmdb') return getTmdbSeasonEpisodes(sourceId, season);
  const episodes: EpisodeInfo[] = [];
  let page = 1;
  let hasNextPage = true;
  while (hasNextPage) {
    const result = await getJikanEpisodes(sourceId, page);
    episodes.push(...result.episodes);
    hasNextPage = result.hasNextPage;
    page += 1;
  }
  return episodes;
}

/** "You might also like" shows for the detail screen's Related Shows
 * section — TMDB shows are matched by genre overlap, Jikan/anime by
 * MAL's own community recommendations (see getJikanRelatedShows for
 * why). `genres` is only used on the TMDB path. */
export async function getRelatedShows(
  source: ShowSource,
  sourceId: number,
  genres: string[] | undefined
): Promise<SearchResult[]> {
  if (source === 'tmdb') return getTmdbRelatedShows(genres, sourceId);
  return getJikanRelatedShows(sourceId);
}
