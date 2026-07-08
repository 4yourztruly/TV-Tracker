import type { SearchResult, TrackedShow } from '../types/show';
import { getShowDetails, getRelatedShows } from '../api/search';
import { getImdbRating } from '../api/omdb';

/** Builds a fresh TrackedShow from a search result (or any other
 * source/sourceId pair — e.g. a Related Shows tile), fetching full
 * details, the IMDb rating, and related shows together. Used both to
 * add a show outright and to build the "preview" shown before a show
 * is actually added (see ShowDetailScreen's isPreview mode) — related
 * shows used to only backfill for already-tracked shows, so a preview
 * never showed any; fetching it here means it shows up immediately,
 * before the show is even added. */
export async function buildTrackedShow(result: SearchResult): Promise<TrackedShow> {
  const details = await getShowDetails(result.source, result.sourceId);
  // Fetched together (not sequentially) — the rating is cached on the
  // show going forward, so this is the only OMDb lookup it'll ever
  // need instead of one every time it's viewed. Related shows needs
  // `details.genres` as input on the TMDB path, so it can't join the
  // details fetch itself, but can still run alongside the OMDb lookup.
  // A related-shows failure shouldn't block adding/previewing the show
  // at all — it's a nice-to-have, so it falls back to empty instead of
  // rejecting the whole build.
  const [omdbRating, relatedShows] = await Promise.all([
    getImdbRating(result.title, result.year),
    getRelatedShows(result.source, result.sourceId, details.genres).catch((err) => {
      console.error('Failed to fetch related shows:', err);
      return [];
    }),
  ]);
  // OMDb has thin coverage of anime — when it comes back with nothing
  // (null/undefined) but the source itself reports a community score
  // (AniList), show that instead of no rating at all.
  const imdbRating = omdbRating != null ? omdbRating : (details.communityScore ?? omdbRating);
  return {
    id: crypto.randomUUID(),
    source: result.source,
    sourceId: result.sourceId,
    title: details.title,
    summary: details.summary,
    posterUrl: details.posterUrl ?? result.posterUrl,
    status: 'unwatched',
    watchedEpisodes: {},
    totalEpisodes: details.totalEpisodes,
    seriesStatus: details.seriesStatus,
    seriesStatusUpdatedAt: Date.now(),
    seriesStatusVersion: 2,
    episodeRuntimeMinutes: details.episodeRuntimeMinutes,
    // Each of these must resolve to a concrete "checked" value (even an
    // empty one), never bare `undefined` — ShowDetailScreen's preview
    // path (isPreview, no `trackedShow`) never runs the backfill retry
    // that normally covers an already-tracked show missing one of
    // these, so an `undefined` here left contentReady stuck behind the
    // spinner forever instead of just meaning "nothing found".
    genres: details.genres ?? [],
    castNames: details.castNames ?? [],
    ageRating: details.ageRating ?? null,
    backdropUrls: details.backdropUrls ?? [],
    startYear: details.startYear ?? null,
    endYear: details.endYear ?? null,
    imdbRating,
    relatedShows,
    seasons: details.seasons,
    addedAt: Date.now(),
    updatedAt: Date.now(),
  };
}
