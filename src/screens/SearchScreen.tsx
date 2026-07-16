import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { SearchResult } from '../types/show';
import { searchAll } from '../api/search';
import { getTopRatedShows, topRatedToSearchResult } from '../api/topRated';
import { useAppStore } from '../store/store';
import { buildTrackedShow } from '../utils/buildTrackedShow';
import { RatingBadge, RatingSourceIcon } from '../components/RatingBadge';
import { ratingTextColorClass, resolveSearchResultRating } from '../utils/ratingSource';
import { Spinner } from '../components/Spinner';

const SEARCH_DEBOUNCE_MS = 300;

export function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Which specific result (if any) failed to open — shown inline on
  // that row instead of the generic `error` banner above, which lives
  // up by the search box and is easy to miss once you're scrolled down
  // into results, making a failed tap look like it silently did
  // nothing. (Some TMDB search results are genuinely stale/broken —
  // e.g. an indexed show whose own detail endpoint now 404s — so this
  // is a real, recurring case, not just theoretical.)
  const [openErrorKey, setOpenErrorKey] = useState<string | null>(null);

  // Shown below the search bar when it's empty — a browse grid, not a
  // search result. Fully static (title/rating/poster/id all hardcoded
  // in the curated list) — no network call to show it or to open a
  // tile; tapping goes straight through the normal handleOpenDetails
  // flow, same as any other search result.
  const topRated = getTopRatedShows();

  // Each row's IMDb rating reports in once its lookup settles, so the
  // whole results list can be held behind a spinner and revealed all
  // at once instead of ratings popping in one row at a time.
  const [ratingReadyKeys, setRatingReadyKeys] = useState<Set<string>>(new Set());
  const markRatingReady = useCallback((key: string) => {
    setRatingReadyKeys((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
  }, []);
  const ratingsReady = results.every((r) => ratingReadyKeys.has(`${r.source}-${r.sourceId}`));

  const shows = useAppStore((s) => s.shows);
  const addShow = useAppStore((s) => s.addShow);
  const searchResetToken = useAppStore((s) => s.searchResetToken);
  const pushOverlay = useAppStore((s) => s.pushOverlay);

  // Tapping the Search tab's icon while already on it resets back to
  // the default Top Rated browse view instead of leaving whatever was
  // typed/searched still showing.
  useEffect(() => {
    if (searchResetToken === 0) return; // skip on initial mount
    setQuery('');
    setResults([]);
    setError(null);
  }, [searchResetToken]);

  async function runSearch(q: string) {
    setLoading(true);
    setError(null);
    try {
      const r = await searchAll(q);
      setResults(r);
      if (r.length === 0) setError('No results found.');
    } catch (err) {
      console.error(err);
      setError('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Live search-as-you-type: fires shortly after each keystroke rather
  // than waiting for a submit, so results update per letter typed.
  // Debounced so a fast typist doesn't fire a request per keystroke.
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timeout = setTimeout(() => {
      runSearch(trimmed);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // The debounced effect above already keeps this tab's own compact
  // list updated as-you-type — submitting (Enter or the Search button)
  // is a deliberate "show me everything" action, opening the fuller
  // SearchResultsScreen overlay instead.
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) pushOverlay({ searchResultsQuery: trimmed });
  }

  function existingTrackedShow(result: SearchResult) {
    return shows.find((s) => s.source === result.source && s.sourceId === result.sourceId);
  }

  /** Quick-add straight from the list, no detail view. */
  async function handleAdd(result: SearchResult) {
    const key = `${result.source}-${result.sourceId}`;
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

  /** Tapping the card opens the same detail view used on the home
   * screen — showing summary, seasons, and episodes — even before the
   * show has been added. If it's already tracked, opens the real one
   * (so progress/season state shows correctly) instead of a fresh
   * preview. */
  async function handleOpenDetails(result: SearchResult) {
    const existing = existingTrackedShow(result);
    if (existing) {
      pushOverlay({ selectedShowId: existing.id });
      return;
    }
    const key = `${result.source}-${result.sourceId}`;
    setOpeningId(key);
    setOpenErrorKey(null);
    try {
      pushOverlay({ previewShow: await buildTrackedShow(result) });
    } catch (err) {
      console.error('Failed to load show details:', err);
      setOpenErrorKey(key);
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search shows or anime…"
            className="w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 pr-9 text-base text-ink-100 placeholder:text-ink-400 focus:border-signal-500 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-ink-400 transition-colors hover:text-ink-100"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-signal-500 px-4 py-2 text-sm font-semibold text-ink-950 transition-colors hover:bg-signal-600 disabled:opacity-50"
        >
          {loading ? '…' : 'Search'}
        </button>
      </form>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {!query.trim() && (
        <div className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400">
            Top Rated
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {topRated.map((entry) => {
              const result = topRatedToSearchResult(entry);
              const key = `${result.source}-${result.sourceId}`;
              return (
                <button
                  key={key}
                  onClick={() => handleOpenDetails(result)}
                  disabled={openingId === key}
                  className="group flex flex-col gap-1.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal-500 focus-visible:outline-offset-2 rounded-lg disabled:opacity-70"
                >
                  <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-ink-800 ring-1 ring-inset ring-ink-800 transition-transform group-active:scale-[0.97]">
                    <img
                      src={entry.posterUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    {openingId === key && (
                      <div className="absolute inset-0 flex items-center justify-center bg-ink-950/60">
                        <Spinner size={20} />
                      </div>
                    )}
                    {openErrorKey === key && (
                      <div className="absolute inset-0 flex items-center justify-center bg-ink-950/80 px-1 text-center text-[10px] font-medium text-red-400">
                        Couldn't load — tap to retry
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <p className="min-w-0 flex-1 truncate text-xs font-medium text-ink-200">
                      {entry.title}
                    </p>
                    <span
                      className={`flex-shrink-0 inline-flex items-center gap-0.5 text-[10px] font-semibold ${ratingTextColorClass('imdb')}`}
                    >
                      <RatingSourceIcon source="imdb" className="h-2.5 w-2.5" />
                      {entry.imdbRating}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="relative min-h-18">
          {!ratingsReady && (
            <div className="absolute inset-0 z-10 flex items-start justify-center bg-ink-950 pt-6">
              <Spinner size={32} />
            </div>
          )}
          <div className={`flex flex-col gap-2 ${ratingsReady ? '' : 'invisible'}`}>
            {results.map((result) => {
              const key = `${result.source}-${result.sourceId}`;
              const existing = existingTrackedShow(result);
              const tracked = !!existing;
              const resolvedRating = resolveSearchResultRating(result, existing);
              return (
                <div
                  key={key}
                  onClick={() => handleOpenDetails(result)}
                  role="button"
                  tabIndex={0}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-ink-800 bg-ink-900 p-3 transition-colors hover:border-ink-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal-500"
                >
                  {result.posterUrl ? (
                    <img
                      src={result.posterUrl}
                      alt=""
                      className="h-16 w-11 flex-shrink-0 rounded-md object-cover bg-ink-800"
                    />
                  ) : (
                    <div className="h-16 w-11 flex-shrink-0 rounded-md bg-ink-800" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-ink-100">
                        {openingId === key
                          ? 'Loading…'
                          : `${result.title}${result.year ? ` (${result.year})` : ''}`}
                      </span>
                      {openingId !== key && (
                        <RatingBadge
                          title={result.title}
                          year={result.year}
                          knownRating={resolvedRating.knownRating}
                          source={resolvedRating.source}
                          onReady={() => markRatingReady(key)}
                        />
                      )}
                    </p>
                    <p className="text-xs text-ink-400">
                      {openErrorKey === key ? (
                        <span className="text-red-400">Couldn't load — tap to retry</span>
                      ) : (
                        result.source === 'tmdb' ? 'TV' : 'Anime'
                      )}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // don't also open the detail view
                      handleAdd(result);
                    }}
                    disabled={tracked || addingId === key}
                    className="flex-shrink-0 rounded-lg border border-ink-700 px-3 py-1.5 text-xs font-semibold text-ink-100 transition-colors hover:border-signal-500 disabled:opacity-40"
                  >
                    {tracked ? 'Added' : addingId === key ? 'Adding…' : 'Add'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
