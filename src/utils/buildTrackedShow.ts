import type { SearchResult, TrackedShow } from '../types/show';
import { getShowDetails } from '../api/search';
import { getImdbRating } from '../api/omdb';

/** Builds a fresh TrackedShow from a search result (or any other
 * source/sourceId pair — e.g. a Related Shows tile), fetching full
 * details and the IMDb rating together. Used both to add a show
 * outright and to build the "preview" shown before a show is actually
 * added (see ShowDetailScreen's isPreview mode). */
export async function buildTrackedShow(result: SearchResult): Promise<TrackedShow> {
  // Fetched together (not sequentially) — and the rating is cached on
  // the show going forward, so this is the only OMDb lookup it'll
  // ever need instead of one every time it's viewed.
  const [details, imdbRating] = await Promise.all([
    getShowDetails(result.source, result.sourceId),
    getImdbRating(result.title, result.year),
  ]);
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
    genres: details.genres,
    ageRating: details.ageRating,
    backdropUrls: details.backdropUrls,
    imdbRating,
    seasons: details.seasons,
    addedAt: Date.now(),
    updatedAt: Date.now(),
  };
}
