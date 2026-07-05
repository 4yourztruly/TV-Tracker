import { useEffect, useState } from 'react';
import type { SearchResult, TrackedShow } from '../types/show';
import { searchAll, getShowDetails } from '../api/search';
import { useAppStore } from '../store/store';
import { syncToDrive } from '../store/sync';

const SEARCH_DEBOUNCE_MS = 300;

export function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const shows = useAppStore((s) => s.shows);
  const addShow = useAppStore((s) => s.addShow);
  const setPreviewShow = useAppStore((s) => s.setPreviewShow);

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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); // Enter/button just avoids a page reload — the
    // debounced effect above already handles running the search.
  }

  async function buildTrackedShow(result: SearchResult): Promise<TrackedShow> {
    const details = await getShowDetails(result.source, result.sourceId);
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
      seasons: details.seasons,
      addedAt: Date.now(),
      updatedAt: Date.now(),
    };
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
      syncToDrive();
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
      useAppStore.getState().setSelectedShow(existing.id);
      return;
    }
    const key = `${result.source}-${result.sourceId}`;
    setOpeningId(key);
    try {
      setPreviewShow(await buildTrackedShow(result));
    } catch (err) {
      console.error('Failed to load show details:', err);
      setError('Could not load details for that show — please try again.');
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search shows or anime…"
          className="flex-1 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-base text-ink-100 placeholder:text-ink-400 focus:border-signal-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-signal-500 px-4 py-2 text-sm font-semibold text-ink-950 transition-colors hover:bg-signal-600 disabled:opacity-50"
        >
          {loading ? '…' : 'Search'}
        </button>
      </form>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex flex-col gap-2">
        {results.map((result) => {
          const key = `${result.source}-${result.sourceId}`;
          const tracked = !!existingTrackedShow(result);
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
                <p className="truncate text-sm font-semibold text-ink-100">
                  {openingId === key ? 'Loading…' : result.title}
                </p>
                <p className="text-xs text-ink-400">
                  {result.source === 'tmdb' ? 'TV' : 'Anime'}
                  {result.year ? ` · ${result.year}` : ''}
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
  );
}
