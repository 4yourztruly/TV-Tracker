import type { SearchResult } from '../types/show';
import { searchTmdb } from './tmdb';
import { TOP_RATED_SHOWS } from '../data/topRatedShows';

export interface TopRatedEntry {
  result: SearchResult;
  imdbRating: string;
}

// In-memory only — the curated list is static, so once a title's been
// resolved to a TMDB entry this session there's no reason to look it
// up again.
const resolvedCache = new Map<string, SearchResult | null>();

async function resolveOne(title: string, year?: string): Promise<SearchResult | null> {
  const cacheKey = `${title}|${year ?? ''}`;
  if (resolvedCache.has(cacheKey)) return resolvedCache.get(cacheKey)!;
  try {
    const results = await searchTmdb(title);
    // When a year is given, prefer the result matching it (disambiguates
    // a title TMDB's own ranking would otherwise get wrong — e.g. a
    // same-titled remake outranking the original); fall back to TMDB's
    // top result otherwise.
    const match = (year ? results.find((r) => r.year === year) : undefined) ?? results[0] ?? null;
    resolvedCache.set(cacheKey, match);
    return match;
  } catch (err) {
    console.error(`Failed to resolve top-rated show "${title}":`, err);
    return null;
  }
}

/** Resolves the curated top-rated title list (data/topRatedShows.ts)
 * to real TMDB entries for their poster/id/year, paired with the
 * curated rating. A title TMDB can't find is silently dropped. Order
 * follows the curated list — highest rating first — not TMDB's own
 * ranking. */
export async function getTopRatedShows(): Promise<TopRatedEntry[]> {
  const resolved = await Promise.all(
    TOP_RATED_SHOWS.map(async (entry) => ({
      entry,
      result: await resolveOne(entry.title, entry.year),
    }))
  );
  return resolved
    .filter(
      (r): r is { entry: (typeof TOP_RATED_SHOWS)[number]; result: SearchResult } =>
        r.result !== null
    )
    .map((r) => ({ result: r.result, imdbRating: r.entry.imdbRating }));
}
