import type { SearchResult } from '../types/show';
import { TOP_RATED_SHOWS, type TopRatedShowEntry } from '../data/topRatedShows';

export type { TopRatedShowEntry };

/** The curated top-rated list itself — no network call. Every entry
 * already carries its own hardcoded sourceId/posterUrl (resolved once
 * when the list was curated, not looked up live), so this used to fire
 * ~100 TMDB searches every time the Search screen opened is now just a
 * plain array return. */
export function getTopRatedShows(): TopRatedShowEntry[] {
  return TOP_RATED_SHOWS;
}

/** Converts a curated entry straight into the SearchResult shape the
 * rest of the app (search results, show previews) already works with
 * — no fetch, everything needed is already hardcoded on the entry. */
export function topRatedToSearchResult(entry: TopRatedShowEntry): SearchResult {
  return {
    source: 'tmdb',
    sourceId: entry.sourceId,
    title: entry.title,
    posterUrl: entry.posterUrl,
    year: entry.year,
  };
}
