import type { SearchResult, SeasonSummary, SeriesStatus } from '../types/show';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

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
const TMDB_BACKDROP_BASE = 'https://image.tmdb.org/t/p/w780';
// Episode stills double as both the small list-row thumbnail and the
// source image for the full-screen lightbox — w200 (right for the
// thumbnail) looked soft/blurry blown up to fill a phone screen, so
// stills get the same larger size already used for backdrops.
const TMDB_STILL_BASE = 'https://image.tmdb.org/t/p/w780';
// How many backdrop images to keep for the detail screen's photo
// strip. TMDB can return 100+ for popular shows, sorted best-first
// (highest vote_average) — this is plenty for a preview strip.
const MAX_BACKDROPS = 12;

/** The poster stored on a show is the small w200 card-thumbnail size —
 * fine for a poster-sized card, but soft/blurry blown up to fill a
 * phone screen in the full-screen lightbox. Upsizes to the same larger
 * size already used for backdrops/stills when shown that way. Passes
 * non-TMDB (AniList) URLs through unchanged — those are already a
 * reasonably large size. */
export function toFullscreenPosterUrl(url: string): string {
  return url.startsWith(TMDB_IMAGE_BASE) ? url.replace(TMDB_IMAGE_BASE, TMDB_BACKDROP_BASE) : url;
}

function requireKey() {
  if (!TMDB_KEY) {
    throw new Error(
      'Missing VITE_TMDB_API_KEY. Add it to your .env file (see .env.example).'
    );
  }
}

function mapTmdbResult(r: any): SearchResult {
  return {
    source: 'tmdb' as const,
    sourceId: r.id,
    title: r.name,
    posterUrl: r.poster_path ? `${TMDB_IMAGE_BASE}${r.poster_path}` : undefined,
    summary: r.overview || undefined,
    year: r.first_air_date ? r.first_air_date.slice(0, 4) : undefined,
    // vote_average is already part of every TMDB search/discover
    // response — free to carry along, no extra request.
    rating: typeof r.vote_average === 'number' && r.vote_average > 0 ? r.vote_average.toFixed(1) : undefined,
  };
}

export async function searchTmdb(query: string): Promise<SearchResult[]> {
  requireKey();
  const res = await fetchWithTimeout(
    `${TMDB_BASE}/search/tv?query=${encodeURIComponent(query)}&api_key=${TMDB_KEY}`
  );
  if (!res.ok) throw new Error(`TMDB search failed: ${res.status}`);
  const data = await res.json();
  return (data.results || []).map(mapTmdbResult);
}

// TMDB's TV genre id list is a small, stable, documented enum (not
// something worth an extra API round-trip to look up) — used to turn
// the genre *names* already cached on a show back into the ids
// /discover/tv needs.
const TMDB_TV_GENRE_IDS: Record<string, number> = {
  'Action & Adventure': 10759,
  Animation: 16,
  Comedy: 35,
  Crime: 80,
  Documentary: 99,
  Drama: 18,
  Family: 10751,
  Kids: 10762,
  Mystery: 9648,
  News: 10763,
  Reality: 10764,
  'Sci-Fi & Fantasy': 10765,
  Soap: 10766,
  Talk: 10767,
  'War & Politics': 10768,
  Western: 37,
};

const RELATED_SHOWS_LIMIT = 5;

/** "Similar genre" shows via TMDB's /discover/tv, not the /similar
 * endpoint — /similar is a fuzzier "people who liked this also liked"
 * signal that in practice often surfaces loosely-related shows (spot
 * checked: Breaking Bad's /similar led with a kids sitcom). Discovering
 * by this show's own genre ids, AND-ed together, reliably returns
 * shows that actually share its genre combination (Breaking Bad's
 * Drama+Crime surfaces Law & Order, Criminal Minds, The Mentalist,
 * ...). Only the top 2 genres are AND-ed — a show with 3+ genres would
 * otherwise over-constrain the query into very few or zero results. */
export async function getTmdbRelatedShows(
  genres: string[] | undefined,
  excludeShowId: number
): Promise<SearchResult[]> {
  requireKey();
  const genreIds = (genres ?? [])
    .map((g) => TMDB_TV_GENRE_IDS[g])
    .filter((id): id is number => id != null);
  if (genreIds.length === 0) return [];

  const withGenres = genreIds.slice(0, 2).join(',');
  const res = await fetchWithTimeout(
    `${TMDB_BASE}/discover/tv?api_key=${TMDB_KEY}&with_genres=${withGenres}&sort_by=popularity.desc`
  );
  if (!res.ok) throw new Error(`TMDB discover fetch failed: ${res.status}`);
  const data = await res.json();
  return (data.results || [])
    .filter((r: any) => r.id !== excludeShowId)
    .slice(0, RELATED_SHOWS_LIMIT)
    .map(mapTmdbResult);
}

/** Browse TMDB TV shows in a given genre, most popular first — used by
 * GenreScreen when a genre chip is tapped on a TMDB show's detail
 * screen. This is `with_genres` for a single genre id, so any show
 * actually tagged with it is eligible (a show with both Drama and Crime
 * is equally eligible under either).
 *
 * Deliberately sorts by popularity rather than rating: a plain rating
 * sort (tried earlier) surfaces obscure shows with a handful of 10/10
 * votes above shows people actually know, which reads as "random"
 * results for a browse screen — popularity.desc keeps this matching
 * what the name means for a normal viewer. Returns [] for a genre name
 * not in TMDB_TV_GENRE_IDS (shouldn't happen in practice — genre chips
 * only ever come from a show's own already-fetched `genres`, which are
 * TMDB's own names). */
export async function getTmdbShowsByGenre(genreName: string): Promise<SearchResult[]> {
  requireKey();
  const genreId = TMDB_TV_GENRE_IDS[genreName];
  if (genreId == null) return [];

  const res = await fetchWithTimeout(
    `${TMDB_BASE}/discover/tv?api_key=${TMDB_KEY}&with_genres=${genreId}&sort_by=popularity.desc`
  );
  if (!res.ok) throw new Error(`TMDB discover fetch failed: ${res.status}`);
  const data = await res.json();
  return (data.results || []).map(mapTmdbResult);
}

export interface TmdbShowDetails {
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
  castNames?: string[];
  seasons: SeasonSummary[];
}

const MAX_CAST_NAMES = 4;

/** TMDB's `credits` is ordered by billing already — top-billed cast
 * first — so a straight slice of the front gives the main actors. */
function pickCastNames(cast: any[] | undefined): string[] | undefined {
  if (!Array.isArray(cast) || cast.length === 0) return undefined;
  const names = cast.map((c) => c.name).filter(Boolean).slice(0, MAX_CAST_NAMES);
  return names.length > 0 ? names : undefined;
}

/** TMDB's content ratings are per-country. Prefers the US rating (the
 * scheme most familiar to this app's users, e.g. "TV-MA"/"R"); falls
 * back to whatever country reported one first rather than showing
 * nothing. */
/** Picks up to MAX_BACKDROPS images, preferring ones TMDB users have
 * actually voted on (real votes correlate with distinct, curated
 * shots) and spreading any remaining picks across the unvoted tail
 * rather than taking a strict prefix of it. Unvoted images are often
 * uploaded in batches of near-duplicate frames from the same scene —
 * a straight `.slice(0, N)` risks grabbing several of those in a row
 * for shows without enough voted backdrops to fill the strip. */
function pickBackdrops(backdrops: any[] | undefined): string[] | undefined {
  if (!Array.isArray(backdrops) || backdrops.length === 0) return undefined;
  const voted = backdrops.filter((b) => b.vote_count > 0);
  const unvoted = backdrops.filter((b) => b.vote_count === 0);

  const picked = voted.slice(0, MAX_BACKDROPS);
  const remaining = MAX_BACKDROPS - picked.length;
  if (remaining > 0 && unvoted.length > 0) {
    const stride = Math.max(1, Math.floor(unvoted.length / remaining));
    for (let i = 0; i < unvoted.length && picked.length < MAX_BACKDROPS; i += stride) {
      picked.push(unvoted[i]);
    }
  }

  return picked.map((b) => `${TMDB_BACKDROP_BASE}${b.file_path}`);
}

function pickAgeRating(results: any[] | undefined): string | undefined {
  if (!Array.isArray(results) || results.length === 0) return undefined;
  const us = results.find((r) => r.iso_3166_1 === 'US' && r.rating);
  if (us) return us.rating;
  const any = results.find((r) => r.rating);
  return any?.rating || undefined;
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
  const res = await fetchWithTimeout(
    `${TMDB_BASE}/tv/${showId}?api_key=${TMDB_KEY}&append_to_response=content_ratings,images,credits&include_image_language=en,null`
  );
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

  const genres: string[] | undefined =
    Array.isArray(data.genres) && data.genres.length > 0
      ? data.genres.map((g: any) => g.name).filter(Boolean)
      : undefined;

  const ageRating = pickAgeRating(data.content_ratings?.results);
  const backdropUrls = pickBackdrops(data.images?.backdrops);
  const startYear: string | undefined = data.first_air_date
    ? data.first_air_date.slice(0, 4)
    : undefined;
  const endYear: string | undefined = data.last_air_date
    ? data.last_air_date.slice(0, 4)
    : undefined;

  return {
    title: data.name,
    summary: data.overview || undefined,
    posterUrl: data.poster_path ? `${TMDB_IMAGE_BASE}${data.poster_path}` : undefined,
    totalEpisodes: typeof data.number_of_episodes === 'number' ? data.number_of_episodes : null,
    seriesStatus: mapTmdbSeriesStatus(data.status),
    episodeRuntimeMinutes,
    genres,
    ageRating,
    backdropUrls,
    startYear,
    endYear,
    castNames: pickCastNames(data.credits?.cast),
    seasons,
  };
}

export async function getTmdbSeasonEpisodes(showId: number, season: number) {
  requireKey();
  const res = await fetchWithTimeout(
    `${TMDB_BASE}/tv/${showId}/season/${season}?api_key=${TMDB_KEY}`
  );
  if (!res.ok) throw new Error(`TMDB season fetch failed: ${res.status}`);
  const data = await res.json();
  return (data.episodes || []).map((e: any) => ({
    season,
    episode: e.episode_number,
    title: e.name,
    airdate: e.air_date,
    imageUrl: e.still_path ? `${TMDB_STILL_BASE}${e.still_path}` : undefined,
    episodeType:
      e.episode_type === 'finale' || e.episode_type === 'mid_season'
        ? e.episode_type
        : undefined,
  }));
}
