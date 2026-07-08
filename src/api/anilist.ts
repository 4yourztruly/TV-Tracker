import type { SearchResult, SeasonSummary, SeriesStatus } from '../types/show';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

/**
 * AniList — free, keyless GraphQL API for anime metadata. Replaces the
 * old Jikan (unofficial MyAnimeList) integration, which was prone to
 * rate-limit stalls and frequent downtime.
 *
 * Anime shows are identified here by MyAnimeList id (`idMal`), not
 * AniList's own numeric id — that's the id every anime TrackedShow
 * already has stored as `sourceId` from the Jikan days, and AniList's
 * schema conveniently supports looking a show up BY idMal, so no id
 * remapping was needed when switching APIs (see migrateLegacyData.ts
 * for the `source` field rename). New shows added going forward are
 * also keyed the same way, so the two eras stay consistent.
 */

const ANILIST_BASE = 'https://graphql.anilist.co';
const ANILIST_TIMEOUT_MS = 10000;

async function anilistQuery<T = any>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetchWithTimeout(ANILIST_BASE, ANILIST_TIMEOUT_MS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`AniList request failed: ${res.status}`);
  const body = await res.json();
  if (body.errors?.length) throw new Error(`AniList error: ${body.errors[0]?.message ?? 'unknown'}`);
  return body.data;
}

/** AniList's description field can still carry stray HTML (`<br>`,
 * `<i>`, ...) even with asHtml suppressed — strip it defensively. */
function stripHtml(text: string | null | undefined): string | undefined {
  if (!text) return undefined;
  const stripped = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return stripped || undefined;
}

function pickTitle(title: { romaji?: string; english?: string } | null | undefined): string {
  return title?.english || title?.romaji || 'Untitled';
}

const SEARCH_QUERY = `
query ($search: String) {
  Page(perPage: 10) {
    media(search: $search, type: ANIME) {
      idMal
      title { romaji english }
      coverImage { large }
      description(asHtml: false)
      seasonYear
    }
  }
}`;

export async function searchAnilist(query: string): Promise<SearchResult[]> {
  const data = await anilistQuery(SEARCH_QUERY, { search: query });
  const media: any[] = data?.Page?.media ?? [];
  return media
    .filter((m) => m.idMal != null)
    .map((m) => ({
      source: 'anilist' as const,
      sourceId: m.idMal,
      title: pickTitle(m.title),
      posterUrl: m.coverImage?.large || undefined,
      summary: stripHtml(m.description),
      year: m.seasonYear ? String(m.seasonYear) : undefined,
    }));
}

export interface AnilistAnimeDetails {
  title: string;
  summary?: string;
  posterUrl?: string;
  totalEpisodes: number | null;
  seriesStatus: SeriesStatus;
  episodeRuntimeMinutes?: number;
  genres?: string[];
  ageRating?: string;
  startYear?: string;
  endYear?: string;
  /** 0-10 style community score string (e.g. "8.4"), when AniList
   * reports one — used as a ratings fallback for anime, which OMDb
   * (the app's usual rating source) has thin coverage of. */
  communityScore?: string;
  castNames?: string[];
  seasons: SeasonSummary[]; // anime is usually modeled as a single "season 1" block
}

const DETAILS_QUERY = `
query ($idMal: Int) {
  Media(idMal: $idMal, type: ANIME) {
    idMal
    title { romaji english }
    description(asHtml: false)
    coverImage { large }
    episodes
    duration
    status
    genres
    averageScore
    isAdult
    startDate { year }
    endDate { year }
    relations {
      edges {
        relationType
        node { idMal type status }
      }
    }
    characters(sort: [ROLE, RELEVANCE], perPage: 6) {
      edges {
        role
        node { name { full } }
      }
    }
  }
}`;

async function fetchAnilistStatusAndSequel(
  malId: number
): Promise<{ status: string | undefined; sequelId: number | null }> {
  const data = await anilistQuery(
    `query ($idMal: Int) { Media(idMal: $idMal, type: ANIME) { status relations { edges { relationType node { idMal type } } } } }`,
    { idMal: malId }
  );
  const media = data?.Media;
  const sequel = (media?.relations?.edges ?? []).find(
    (e: any) => e.relationType === 'SEQUEL' && e.node?.type === 'ANIME'
  );
  return { status: media?.status, sequelId: sequel?.node?.idMal ?? null };
}

/** Mirrors the old Jikan sequel-chain walk: a "Sequel" relation can
 * point at an entry that's already finished airing years ago (long-
 * running anime are split into many MAL/AniList entries), so "does a
 * sequel exist" isn't the same question as "is there more content
 * still to come". Walks the chain (bounded) looking for one that's
 * still airing or not yet released. */
async function hasUpcomingContent(
  status: string | undefined,
  sequelId: number | null
): Promise<boolean> {
  if (status === 'RELEASING' || status === 'NOT_YET_RELEASED') return true;

  let nextId = sequelId;
  const MAX_HOPS = 5;
  for (let i = 0; i < MAX_HOPS && nextId != null; i++) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    try {
      const next = await fetchAnilistStatusAndSequel(nextId);
      if (next.status === 'RELEASING' || next.status === 'NOT_YET_RELEASED') return true;
      nextId = next.sequelId;
    } catch (err) {
      console.error('Failed to walk AniList sequel chain:', err);
      return false;
    }
  }
  return false;
}

/** Anime rarely has TMDB-style numbered seasons in AniList's data model
 * — a new "season" is usually its own separate entry. So each tracked
 * anime is modeled as a single season containing all episodes, same as
 * the old Jikan integration. */
export async function getAnilistAnimeDetails(malId: number): Promise<AnilistAnimeDetails> {
  const data = await anilistQuery(DETAILS_QUERY, { idMal: malId });
  const media = data?.Media;
  if (!media) throw new Error(`AniList details fetch failed: no media for idMal ${malId}`);

  const episodeCount: number | null = typeof media.episodes === 'number' ? media.episodes : null;

  const sequelRelation = (media.relations?.edges ?? []).find(
    (e: any) => e.relationType === 'SEQUEL' && e.node?.type === 'ANIME'
  );
  const sequelId: number | null = sequelRelation?.node?.idMal ?? null;

  let seriesStatus: SeriesStatus;
  if (media.status === 'RELEASING' || media.status === 'NOT_YET_RELEASED' || media.status === 'HIATUS') {
    seriesStatus = 'ongoing';
  } else if (media.status === 'FINISHED') {
    seriesStatus = (await hasUpcomingContent(media.status, sequelId)) ? 'ongoing' : 'ended';
  } else if (media.status === 'CANCELLED') {
    seriesStatus = 'ended';
  } else {
    seriesStatus = 'unknown';
  }

  const genres: string[] | undefined =
    Array.isArray(media.genres) && media.genres.length > 0 ? media.genres : undefined;

  const castNames: string[] | undefined = (() => {
    const edges = media.characters?.edges ?? [];
    const mains = edges
      .filter((e: any) => e.role === 'MAIN')
      .map((e: any) => e.node?.name?.full)
      .filter(Boolean);
    const names = mains.length > 0 ? mains : edges.map((e: any) => e.node?.name?.full).filter(Boolean);
    return names.length > 0 ? names.slice(0, 4) : undefined;
  })();

  return {
    title: pickTitle(media.title),
    summary: stripHtml(media.description),
    posterUrl: media.coverImage?.large || undefined,
    totalEpisodes: episodeCount,
    seriesStatus,
    episodeRuntimeMinutes: typeof media.duration === 'number' ? media.duration : undefined,
    genres,
    // AniList doesn't expose a granular content rating (PG/R/TV-MA
    // style) like MAL's `rating` field did — `isAdult` only flags
    // explicit hentai content, so that's the only signal available.
    ageRating: media.isAdult ? 'R+ (Explicit)' : undefined,
    startYear: media.startDate?.year ? String(media.startDate.year) : undefined,
    endYear: media.endDate?.year ? String(media.endDate.year) : undefined,
    communityScore:
      typeof media.averageScore === 'number' ? (media.averageScore / 10).toFixed(1) : undefined,
    castNames,
    seasons: [{ season: 1, episodeCount: episodeCount ?? 0 }],
  };
}

/** AniList has no per-episode-title endpoint as reliable as MAL's —
 * `streamingEpisodes` is scraped from streaming sites and often
 * missing/inconsistent, so this falls back to plain "Episode N"
 * placeholders when it isn't usable. Returns everything in one call
 * (no pagination needed, unlike the old Jikan integration). */
export async function getAnilistEpisodes(malId: number) {
  const data = await anilistQuery(
    `query ($idMal: Int) { Media(idMal: $idMal, type: ANIME) { episodes streamingEpisodes { title } } }`,
    { idMal: malId }
  );
  const media = data?.Media;
  const totalEpisodes: number = typeof media?.episodes === 'number' ? media.episodes : 0;
  const streaming: any[] = media?.streamingEpisodes ?? [];

  const episodes = Array.from({ length: totalEpisodes }, (_, i) => {
    const raw: string | undefined = streaming[i]?.title;
    // Streaming-site titles usually look like "Episode 3 - The Actual
    // Title" — keep just the part after the dash when present.
    const title = raw?.includes(' - ') ? raw.split(' - ').slice(1).join(' - ').trim() : undefined;
    return { season: 1, episode: i + 1, title: title || undefined };
  });

  return { episodes, hasNextPage: false };
}

const RELATED_SHOWS_LIMIT = 5;

/** AniList's own community recommendations — the closest equivalent to
 * the old Jikan `/recommendations` endpoint used for anime's Related
 * Shows section. Already sorted best-first. */
export async function getAnilistRelatedShows(malId: number): Promise<SearchResult[]> {
  const data = await anilistQuery(
    `query ($idMal: Int) {
      Media(idMal: $idMal, type: ANIME) {
        recommendations(sort: RATING_DESC, perPage: ${RELATED_SHOWS_LIMIT}) {
          edges { node { mediaRecommendation { idMal title { romaji english } coverImage { large } } } }
        }
      }
    }`,
    { idMal: malId }
  );
  const edges: any[] = data?.Media?.recommendations?.edges ?? [];
  return edges
    .map((e) => e.node?.mediaRecommendation)
    .filter((m) => m?.idMal != null && m.idMal !== malId)
    .map((m) => ({
      source: 'anilist' as const,
      sourceId: m.idMal,
      title: pickTitle(m.title),
      posterUrl: m.coverImage?.large || undefined,
    }));
}
