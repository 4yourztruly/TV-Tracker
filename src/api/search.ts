import type { EpisodeInfo, SearchResult, ShowSource, SeasonSummary, SeriesStatus } from '../types/show';
import { searchTmdb, getTmdbShowDetails, getTmdbSeasonEpisodes } from './tmdb';
import { searchJikan, getJikanAnimeDetails, getJikanEpisodes } from './jikan';

/** Runs both searches in parallel and merges results. If one source
 * fails (e.g. missing TMDB key), the other still returns results
 * rather than failing the whole search. */
export async function searchAll(query: string): Promise<SearchResult[]> {
  const [tmdbResult, jikanResult] = await Promise.allSettled([
    searchTmdb(query),
    searchJikan(query),
  ]);

  const results: SearchResult[] = [];
  if (tmdbResult.status === 'fulfilled') results.push(...tmdbResult.value);
  else console.warn('TMDB search failed:', tmdbResult.reason);

  if (jikanResult.status === 'fulfilled') results.push(...jikanResult.value);
  else console.warn('Jikan search failed:', jikanResult.reason);

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
