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
// sync or persistence beyond TrackedShow.imdbRating itself, and this
// just avoids re-fetching the same title twice in one session (e.g.
// once for its search-result row, once for buildTrackedShow on Add).
// Only confirmed results are cached here (found or confirmed no
// match) — a transient failure is deliberately NOT cached, so it gets
// retried rather than a temporary outage looking like "no rating"
// forever once callers persist it onto a show.
const ratingCache = new Map<string, string | null>();

/** Resolves to the IMDb rating (e.g. "8.4") for a show title.
 * - A string: OMDb has a rating.
 * - `null`: OMDb answered but confirmed no match/no rating — safe for
 *   a caller to persist as "checked, nothing there".
 * - `undefined`: couldn't tell (no key configured, request failed, hit
 *   OMDb's rate limit, ...) — callers should NOT persist this as a
 *   permanent "no rating"; leave it unset and try again later.
 * Never throws. */
export async function getImdbRating(
  title: string,
  year?: string
): Promise<string | null | undefined> {
  if (!OMDB_KEY) return undefined;

  const cacheKey = `${title.toLowerCase()}|${year ?? ''}`;
  if (ratingCache.has(cacheKey)) return ratingCache.get(cacheKey)!;

  try {
    const params = new URLSearchParams({ apikey: OMDB_KEY, t: title, type: 'series' });
    if (year) params.set('y', year);
    const res = await fetch(`${OMDB_BASE}?${params.toString()}`);
    if (!res.ok) {
      // Includes OMDb's "Request limit reached!" 401 on the free
      // tier's daily cap — transient, not "this show has no rating".
      console.error(`OMDb lookup failed: ${res.status}`);
      return undefined;
    }
    const data = await res.json();
    const rating =
      data.Response === 'True' && data.imdbRating && data.imdbRating !== 'N/A'
        ? (data.imdbRating as string)
        : null;
    ratingCache.set(cacheKey, rating);
    return rating;
  } catch (err) {
    console.error('OMDb rating lookup failed:', err);
    return undefined;
  }
}
