import type { EpisodeInfo, SearchResult, ShowSource, SeasonSummary, SeriesStatus } from '../types/show';
import {
  searchTmdb,
  getTmdbShowDetails,
  getTmdbSeasonEpisodes,
  getTmdbRelatedShows,
  getTmdbShowsByGenre,
} from './tmdb';
import {
  searchAnilist,
  getAnilistAnimeDetails,
  getAnilistEpisodes,
  getAnilistRelatedShows,
  getAnilistShowsByGenre,
} from './anilist';

// In-memory only, per query string — search-as-you-type means the
// same text often gets searched again a moment later (backspacing
// and retyping, refocusing the field, ...); this just avoids re-
// hitting both APIs for a query already answered this session.
const searchCache = new Map<string, SearchResult[]>();

// In-memory only, per source+genre — re-opening the same genre chip
// (from the same show again, or from a different show that shares the
// genre) within a session reuses the last result instead of re-hitting
// the browse API every time.
const genreCache = new Map<string, SearchResult[]>();

function normalizeTitleForDedup(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function resultScore(r: SearchResult): number {
  return (r.posterUrl ? 1 : 0) + (r.summary ? 1 : 0) + (r.year ? 1 : 0);
}

function pickBest(group: SearchResult[]): SearchResult {
  return group.reduce((best, candidate) => (resultScore(candidate) > resultScore(best) ? candidate : best));
}

/** TMDB in particular sometimes indexes the same show under more than
 * one id (spot-checked live: a search for "One Piece" returns both the
 * real entry and a second, case-different duplicate DB row, and a
 * search for "Solo Leveling" returns a second "Solo Leveling" row with
 * no poster AND no year alongside the real, dated one) — tapping the
 * broken duplicate showed "Couldn't load" since it has no usable
 * detail data.
 *
 * Groups same-source results by normalized title. Within a group, a
 * year-less entry is treated as a low-quality duplicate of whichever
 * dated entry shares its title rather than its own real result — a
 * missing year isn't good evidence of being a genuinely different
 * show. Only when the group has two or more entries with DIFFERENT
 * known years are they kept as separate, real shows (e.g. "One Piece"
 * 1999 the anime vs. "One Piece" 2023 the Netflix adaptation).
 *
 * Deliberately scoped to within one source's own results, not across
 * TMDB+AniList — an anime and an unrelated live-action show can
 * legitimately share a title, and those are two real, separate entries. */
function dedupeSameSourceResults(results: SearchResult[]): SearchResult[] {
  const groupsByTitle = new Map<string, SearchResult[]>();
  for (const result of results) {
    const key = normalizeTitleForDedup(result.title);
    const group = groupsByTitle.get(key);
    if (group) group.push(result);
    else groupsByTitle.set(key, [result]);
  }

  const output: SearchResult[] = [];
  for (const group of groupsByTitle.values()) {
    const distinctYears = new Set(group.map((r) => r.year).filter(Boolean));
    if (distinctYears.size <= 1) {
      output.push(pickBest(group));
      continue;
    }

    // Two or more real, differently-dated shows share this title —
    // keep one per known year, folding any year-less stragglers into
    // whichever dated group ends up best rather than showing them as
    // their own (often broken) row.
    const byYear = new Map<string, SearchResult[]>();
    for (const result of group) {
      const yearKey = result.year ?? '';
      const bucket = byYear.get(yearKey);
      if (bucket) bucket.push(result);
      else byYear.set(yearKey, [result]);
    }
    const undated = byYear.get('') ?? [];
    byYear.delete('');
    const datedGroups = [...byYear.values()];
    if (datedGroups.length > 0) datedGroups[0].push(...undated);
    else datedGroups.push(undated);
    for (const datedGroup of datedGroups) output.push(pickBest(datedGroup));
  }
  return output;
}

/** Runs both searches in parallel and merges results. If one source
 * fails (e.g. missing TMDB key), the other still returns results
 * rather than failing the whole search. */
export async function searchAll(query: string): Promise<SearchResult[]> {
  const cacheKey = query.trim().toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached) return cached;

  const [tmdbResult, anilistResult] = await Promise.allSettled([
    searchTmdb(query),
    searchAnilist(query),
  ]);

  const results: SearchResult[] = [];
  if (tmdbResult.status === 'fulfilled') results.push(...dedupeSameSourceResults(tmdbResult.value));
  else console.warn('TMDB search failed:', tmdbResult.reason);

  if (anilistResult.status === 'fulfilled') results.push(...dedupeSameSourceResults(anilistResult.value));
  else console.warn('AniList search failed:', anilistResult.reason);

  // Only cache when at least one source actually answered — don't
  // lock in an empty result set from a moment where both happened to
  // fail.
  if (tmdbResult.status === 'fulfilled' || anilistResult.status === 'fulfilled') {
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
  /** 0-10 style community score, AniList-sourced only — used as a
   * ratings fallback for anime (see buildTrackedShow). */
  communityScore?: string;
  /** Up to a handful of main cast/voice-actor names, when the source
   * provides them. */
  castNames?: string[];
  seasons: SeasonSummary[];
}

export async function getShowDetails(
  source: ShowSource,
  sourceId: number
): Promise<ShowDetails> {
  if (source === 'tmdb') return getTmdbShowDetails(sourceId);
  return getAnilistAnimeDetails(sourceId);
}

/** Fetches the named episode list for a single season, dispatching to
 * the right source. Used lazily when a season is expanded in the UI. */
export async function getSeasonEpisodes(
  source: ShowSource,
  sourceId: number,
  season: number
): Promise<EpisodeInfo[]> {
  if (source === 'tmdb') return getTmdbSeasonEpisodes(sourceId, season);
  const result = await getAnilistEpisodes(sourceId);
  return result.episodes;
}

/** "You might also like" shows for the detail screen's Related Shows
 * section — TMDB shows are matched by genre overlap, anime by
 * AniList's own community recommendations (see getAnilistRelatedShows
 * for why). `genres` is only used on the TMDB path. */
export async function getRelatedShows(
  source: ShowSource,
  sourceId: number,
  genres: string[] | undefined
): Promise<SearchResult[]> {
  if (source === 'tmdb') return getTmdbRelatedShows(genres, sourceId);
  return getAnilistRelatedShows(sourceId);
}

/** Browse shows in a given genre, best-rated first — powers GenreScreen
 * when a genre chip is tapped on a show's detail screen. Dispatches by
 * source since TMDB and AniList each have their own genre vocabulary
 * and query shape (see getTmdbShowsByGenre / getAnilistShowsByGenre).
 * Cached in memory per source+genre (see genreCache) — tapping the same
 * genre again this session (from the same show, or a different one
 * that shares it) costs nothing further. */
export async function getShowsByGenre(
  source: ShowSource,
  genreName: string
): Promise<SearchResult[]> {
  const cacheKey = `${source}:${genreName}`;
  const cached = genreCache.get(cacheKey);
  if (cached) return cached;

  const results = source === 'tmdb' ? await getTmdbShowsByGenre(genreName) : await getAnilistShowsByGenre(genreName);
  genreCache.set(cacheKey, results);
  return results;
}
