/**
 * OMDb — used only to look up a show's IMDb rating. Free API key from
 * https://www.omdbapi.com/apikey.aspx (1,000 requests/day on the free
 * tier). OMDb has no concept of TMDB/MAL ids, so lookups are by title
 * (optionally scoped by year to disambiguate remakes/similarly-named
 * shows) rather than a direct id join like the TMDB/Jikan clients use.
 *
 * This is a nice-to-have overlay on top of the show data, not core
 * data itself: a missing key, a miss on OMDb's side (common for
 * anime, which OMDb has thin coverage of), or a network hiccup should
 * all just mean "no rating shown" rather than a visible error.
 */

const OMDB_KEY = import.meta.env.VITE_OMDB_API_KEY as string | undefined;
const OMDB_BASE = 'https://www.omdbapi.com/';

// In-memory only — ratings don't change often enough to need Drive
// sync or persistence, and this just avoids re-fetching the same
// title while it stays mounted/re-rendered/scrolled past this session.
const ratingCache = new Map<string, string | null>();

/** Resolves to the IMDb rating (e.g. "8.4") for a show title, or null
 * if unavailable for any reason (no key configured, no OMDb match, or
 * a request failure). Never throws. */
export async function getImdbRating(title: string, year?: string): Promise<string | null> {
  if (!OMDB_KEY) return null;

  const cacheKey = `${title.toLowerCase()}|${year ?? ''}`;
  if (ratingCache.has(cacheKey)) return ratingCache.get(cacheKey)!;

  try {
    const params = new URLSearchParams({ apikey: OMDB_KEY, t: title, type: 'series' });
    if (year) params.set('y', year);
    const res = await fetch(`${OMDB_BASE}?${params.toString()}`);
    if (!res.ok) throw new Error(`OMDb lookup failed: ${res.status}`);
    const data = await res.json();
    const rating =
      data.Response === 'True' && data.imdbRating && data.imdbRating !== 'N/A'
        ? (data.imdbRating as string)
        : null;
    ratingCache.set(cacheKey, rating);
    return rating;
  } catch (err) {
    console.error('OMDb rating lookup failed:', err);
    ratingCache.set(cacheKey, null);
    return null;
  }
}
