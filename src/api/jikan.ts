import type { SearchResult, SeasonSummary, SeriesStatus } from '../types/show';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

/**
 * Jikan — unofficial MyAnimeList API. Free, no API key required.
 * Rate limit is roughly 3 req/sec and 60/min, so batch operations
 * should be throttled (see utils/throttle.ts) rather than fired at once.
 * Also just plain flaky — its upstream (MyAnimeList) occasionally
 * 504s or hangs, so calls here use a shorter timeout than the other
 * APIs to fail fast rather than leaving the UI stuck loading.
 */

const JIKAN_BASE = 'https://api.jikan.moe/v4';
const JIKAN_TIMEOUT_MS = 10000;

export async function searchJikan(query: string): Promise<SearchResult[]> {
  const res = await fetchWithTimeout(
    `${JIKAN_BASE}/anime?q=${encodeURIComponent(query)}&limit=10`,
    JIKAN_TIMEOUT_MS
  );
  if (!res.ok) throw new Error(`Jikan search failed: ${res.status}`);
  const data = await res.json();
  return (data.data || []).map((a: any) => ({
    source: 'jikan' as const,
    sourceId: a.mal_id,
    title: a.title,
    posterUrl: a.images?.jpg?.image_url,
    summary: a.synopsis || undefined,
    year: a.year ? String(a.year) : undefined,
  }));
}

export interface JikanAnimeDetails {
  title: string;
  summary?: string;
  posterUrl?: string;
  totalEpisodes: number | null; // null if still airing / unknown on MAL
  seriesStatus: SeriesStatus;
  episodeRuntimeMinutes?: number;
  genres?: string[];
  ageRating?: string;
  startYear?: string;
  endYear?: string;
  seasons: SeasonSummary[]; // anime is usually modeled as a single "season 1" block
}

/** Jikan's `rating` field is a free-text string like "R - 17+ (violence
 * & profanity)" — this keeps just the short code (e.g. "R") to match
 * the compact TV-MA/PG-13-style rating shown for TMDB shows. */
function parseJikanAgeRating(rating: string | null | undefined): string | undefined {
  if (!rating) return undefined;
  return rating.split(' - ')[0].trim() || undefined;
}

/** MAL splits long-running anime into a separate entry per season/cour
 * (e.g. Attack on Titan is ~7 separate entries). Each of those keeps a
 * "Sequel" relation pointing at the next entry forever — even once
 * that next entry has ALSO finished airing years ago. So "does a
 * sequel entry exist" is not the same question as "is there more
 * content still to come" — Attack on Titan's very first entry still
 * has a Sequel relation today, despite the whole franchise having
 * wrapped up. We only want `ongoing` when the chain leads to something
 * that hasn't finished airing yet (Solo Leveling's confirmed-but-not-
 * yet-released season 2, for example).
 */
async function fetchJikanStatusAndSequel(
  malId: number
): Promise<{ status: string | undefined; sequelId: number | null }> {
  const res = await fetchWithTimeout(`${JIKAN_BASE}/anime/${malId}/full`, JIKAN_TIMEOUT_MS);
  if (!res.ok) throw new Error(`Jikan details fetch failed: ${res.status}`);
  const data = await res.json();
  const anime = data.data;
  const sequel = (anime.relations || []).find((r: any) => r.relation === 'Sequel');
  return { status: anime.status, sequelId: sequel?.entry?.[0]?.mal_id ?? null };
}

/** Walks the Sequel chain (bounded, with a short delay between hops to
 * respect Jikan's rate limit) looking for an entry that's still
 * airing or hasn't aired yet. Only that counts as "more seasons to
 * come" — a sequel that already finished airing doesn't. */
async function hasUpcomingContent(
  status: string | undefined,
  sequelId: number | null
): Promise<boolean> {
  if (status === 'Currently Airing' || status === 'Not yet aired') return true;

  let nextId = sequelId;
  const MAX_HOPS = 5;
  for (let i = 0; i < MAX_HOPS && nextId != null; i++) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    try {
      const next = await fetchJikanStatusAndSequel(nextId);
      if (next.status === 'Currently Airing' || next.status === 'Not yet aired') return true;
      nextId = next.sequelId;
    } catch (err) {
      // Network hiccup partway down the chain — don't fail the whole
      // status lookup over it, just stop walking further.
      console.error('Failed to walk Jikan sequel chain:', err);
      return false;
    }
  }
  return false;
}

/** Jikan reports duration as free text like "24 min per ep" or "1 hr 45
 * min" — this pulls a rough minutes estimate since there's no
 * structured field. */
function parseJikanDurationMinutes(duration: string | null | undefined): number | undefined {
  if (!duration) return undefined;
  const hoursMatch = duration.match(/(\d+)\s*hr/);
  const minsMatch = duration.match(/(\d+)\s*min/);
  const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;
  const mins = minsMatch ? parseInt(minsMatch[1], 10) : 0;
  const total = hours * 60 + mins;
  return total > 0 ? total : undefined;
}

/** Anime rarely has TMDB-style numbered seasons in MAL's data model — a
 * new "season" is usually its own separate MAL entry. So each tracked
 * anime is modeled as a single season containing all episodes. */
export async function getJikanAnimeDetails(malId: number): Promise<JikanAnimeDetails> {
  const res = await fetchWithTimeout(`${JIKAN_BASE}/anime/${malId}/full`, JIKAN_TIMEOUT_MS);
  if (!res.ok) throw new Error(`Jikan details fetch failed: ${res.status}`);
  const data = await res.json();
  const anime = data.data;

  const episodeCount: number | null =
    typeof anime.episodes === 'number' ? anime.episodes : null;

  const sequelRelation = (anime.relations || []).find((r: any) => r.relation === 'Sequel');
  const sequelId: number | null = sequelRelation?.entry?.[0]?.mal_id ?? null;

  let seriesStatus: SeriesStatus;
  if (anime.status === 'Currently Airing' || anime.status === 'Not yet aired') {
    seriesStatus = 'ongoing';
  } else if (anime.status === 'Finished Airing') {
    seriesStatus = (await hasUpcomingContent(anime.status, sequelId)) ? 'ongoing' : 'ended';
  } else {
    seriesStatus = 'unknown';
  }

  const genres: string[] | undefined =
    Array.isArray(anime.genres) && anime.genres.length > 0
      ? anime.genres.map((g: any) => g.name).filter(Boolean)
      : undefined;

  const startYear: string | undefined = anime.aired?.prop?.from?.year
    ? String(anime.aired.prop.from.year)
    : undefined;
  const endYear: string | undefined = anime.aired?.prop?.to?.year
    ? String(anime.aired.prop.to.year)
    : undefined;

  return {
    title: anime.title,
    summary: anime.synopsis || undefined,
    posterUrl: anime.images?.jpg?.image_url,
    totalEpisodes: episodeCount,
    seriesStatus,
    episodeRuntimeMinutes: parseJikanDurationMinutes(anime.duration),
    genres,
    ageRating: parseJikanAgeRating(anime.rating),
    startYear,
    endYear,
    seasons: [{ season: 1, episodeCount: episodeCount ?? 0 }],
  };
}

/** Fetches named episode list for an anime, paginated by Jikan in
 * blocks of 100. Used when a season is expanded in the detail view. */
export async function getJikanEpisodes(malId: number, page = 1) {
  const res = await fetchWithTimeout(`${JIKAN_BASE}/anime/${malId}/episodes?page=${page}`, JIKAN_TIMEOUT_MS);
  if (!res.ok) throw new Error(`Jikan episodes fetch failed: ${res.status}`);
  const data = await res.json();
  const episodes = (data.data || []).map((e: any) => ({
    season: 1,
    episode: e.mal_id,
    title: e.title,
  }));
  const hasNextPage = !!data.pagination?.has_next_page;
  return { episodes, hasNextPage };
}

const RELATED_SHOWS_LIMIT = 5;

/** Jikan has no genre-filtered discover endpoint, so unlike the TMDB
 * side this uses MAL's own user-submitted "if you liked this, watch
 * that" recommendations instead — a different signal than genre
 * overlap, but the closest equivalent Jikan offers, and it doesn't
 * need a genre-name-to-id table maintained for MAL's numbering.
 * Already returned sorted by vote count (most-agreed-on first). */
export async function getJikanRelatedShows(malId: number): Promise<SearchResult[]> {
  const res = await fetchWithTimeout(`${JIKAN_BASE}/anime/${malId}/recommendations`, JIKAN_TIMEOUT_MS);
  if (!res.ok) throw new Error(`Jikan recommendations fetch failed: ${res.status}`);
  const data = await res.json();
  return (data.data || [])
    .filter((rec: any) => rec.entry?.mal_id !== malId)
    .slice(0, RELATED_SHOWS_LIMIT)
    .map((rec: any) => ({
      source: 'jikan' as const,
      sourceId: rec.entry.mal_id,
      title: rec.entry.title,
      posterUrl: rec.entry.images?.jpg?.image_url,
    }));
}
