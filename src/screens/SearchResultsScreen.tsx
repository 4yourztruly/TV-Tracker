import { useEffect, useState } from 'react';
import type { SearchResult } from '../types/show';
import { useAppStore } from '../store/store';
import { searchAll } from '../api/search';
import { buildTrackedShow } from '../utils/buildTrackedShow';
import { ShowResultRow } from '../components/ShowResultRow';
import { resolveSearchResultRating } from '../utils/ratingSource';
import { Spinner } from '../components/Spinner';

function resultKey(r: SearchResult): string {
  return `${r.source}-${r.sourceId}`;
}

/** Full-screen search results, opened by submitting the Search tab's
 * search box (not the live-as-you-type list there, which stays as a
 * quick compact preview) — same enhanced row layout as GenreScreen,
 * just in relevance order from searchAll rather than re-sorted by
 * rating (a text search has no "shared genre" concept to rank within,
 * and relevance is what you'd actually want here, not rating). Each
 * TMDB row's rating is still fetched lazily via OMDb, same as the old
 * compact list — not resolved upfront the way GenreScreen does, since
 * this screen doesn't need every rating in hand before it can render
 * (no re-sort depends on it). AniList rows use their own native score
 * instead of an OMDb lookup (see resolveSearchResultRating) — matching
 * anime to OMDb by title alone is unreliable, and a shared title with
 * an unrelated TMDB entry (e.g. "Bleach") used to show that entry's
 * rating on both rows.
 *
 * Mutually exclusive with ShowDetailScreen/GenreScreen — only one of
 * these overlay screens is ever mounted at a time (see pushOverlay/
 * popOverlay in the store). Opening a result pushes it onto the
 * overlay history rather than just replacing it, so the back button
 * returns here instead of exiting straight past it. */
export function SearchResultsScreen() {
  const searchResultsQuery = useAppStore((s) => s.searchResultsQuery);
  const shows = useAppStore((s) => s.shows);
  const addShow = useAppStore((s) => s.addShow);
  const pushOverlay = useAppStore((s) => s.pushOverlay);
  const popOverlay = useAppStore((s) => s.popOverlay);

  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [openErrorKey, setOpenErrorKey] = useState<string | null>(null);

  useEffect(() => {
    if (!searchResultsQuery) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setResults([]);
    searchAll(searchResultsQuery)
      .then((r) => {
        if (cancelled) return;
        setResults(r);
        if (r.length === 0) setError('No results found.');
      })
      .catch((err) => {
        console.error('Search failed:', err);
        if (!cancelled) setError('Search failed. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [searchResultsQuery]);

  if (!searchResultsQuery) return null;

  function existingTrackedShow(result: SearchResult) {
    return shows.find((s) => s.source === result.source && s.sourceId === result.sourceId);
  }

  async function handleAdd(result: SearchResult) {
    const key = resultKey(result);
    setAddingId(key);
    try {
      addShow(await buildTrackedShow(result));
    } catch (err) {
      console.error('Failed to add show:', err);
      setError('Could not add that show — please try again.');
    } finally {
      setAddingId(null);
    }
  }

  async function handleOpenDetails(result: SearchResult) {
    const existing = existingTrackedShow(result);
    if (existing) {
      // pushOverlay records this results screen as a restore point, so
      // the back button returns here instead of exiting straight past
      // it to the search bar.
      pushOverlay({ selectedShowId: existing.id });
      return;
    }
    const key = resultKey(result);
    setOpeningId(key);
    setOpenErrorKey(null);
    try {
      const built = await buildTrackedShow(result);
      pushOverlay({ previewShow: built });
    } catch (err) {
      console.error('Failed to load show details:', err);
      setOpenErrorKey(key);
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex justify-center bg-black/40">
      <div className="flex h-full w-full max-w-[480px] flex-col bg-ink-950 md:border-x md:border-ink-800">
        <div className="sticky top-0 flex items-center gap-2 border-b border-ink-800 bg-ink-950/95 py-1.5 pl-1 pr-4 backdrop-blur">
          <button
            onClick={popOverlay}
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg text-xl text-ink-300 transition-colors active:bg-ink-800/60 hover:text-ink-100"
            aria-label="Back"
          >
            &larr;
          </button>
          <h2 className="truncate text-sm font-semibold text-ink-100">
            &ldquo;{searchResultsQuery}&rdquo;
          </h2>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Spinner size={40} />
            </div>
          )}

          {!loading && error && <p className="text-xs text-red-400">{error}</p>}

          {!loading && results.length > 0 && (
            <div className="flex flex-col gap-2">
              {results.map((result) => {
                const key = resultKey(result);
                const existing = existingTrackedShow(result);
                const resolvedRating = resolveSearchResultRating(result, existing);
                return (
                  <ShowResultRow
                    key={key}
                    result={result}
                    tracked={!!existing}
                    isAdding={addingId === key}
                    isOpening={openingId === key}
                    hasOpenError={openErrorKey === key}
                    knownRating={resolvedRating.knownRating}
                    ratingSource={resolvedRating.source}
                    onOpen={() => handleOpenDetails(result)}
                    onAdd={() => handleAdd(result)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
