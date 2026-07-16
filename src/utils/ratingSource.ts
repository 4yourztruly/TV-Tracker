import type { SearchResult, TrackedShow } from '../types/show';

export type RatingSource = 'imdb' | 'tmdb' | 'anilist';

/** Text color to pair with each source's icon — IMDb's own rating UI
 * shows its number in the same yellow as its star, so that's echoed
 * here; TMDB/AniList-native ratings stay neutral since their icons
 * already carry plenty of color on their own. */
export function ratingTextColorClass(source: RatingSource): string {
  return source === 'imdb' ? 'text-[#F5C518]' : 'text-ink-100';
}

/** Resolves which rating (and whose) to show for a search/browse result
 * — used by SearchScreen and SearchResultsScreen (GenreScreen has its
 * own simpler version, since every result there is untracked-by-
 * definition-of-the-screen and always uses the source's own native
 * rating). An already-tracked show always wins with its own cached
 * rating (real IMDb, or the AniList-community-score fallback — see
 * TrackedShow.imdbRatingSource) regardless of source, since that's a
 * settled, correct answer already paid for.
 *
 * For an untracked result: a TMDB entry falls through to `knownRating:
 * undefined`, letting RatingBadge do its own OMDb lookup by title. An
 * untracked AniList entry instead uses its own native score
 * (`result.rating`) directly — deliberately NOT an OMDb title lookup,
 * which matches by title text alone and has thin, unreliable anime
 * coverage; searching a title that exists as both a TMDB show and an
 * AniList entry (e.g. "Bleach") used to show the *same* OMDb-matched
 * rating on both rows, because both rows independently searched OMDb
 * for the identical title string. */
export function resolveSearchResultRating(
  result: SearchResult,
  existing: TrackedShow | undefined
): { knownRating: string | null | undefined; source: RatingSource } {
  if (existing) {
    return { knownRating: existing.imdbRating, source: existing.imdbRatingSource ?? 'imdb' };
  }
  if (result.source === 'anilist') {
    return { knownRating: result.rating ?? null, source: 'anilist' };
  }
  return { knownRating: undefined, source: 'imdb' };
}
