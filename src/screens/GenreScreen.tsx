import { useEffect, useState } from 'react';
import type { SearchResult } from '../types/show';
import { useAppStore } from '../store/store';
import { getShowsByGenre } from '../api/search';
import { buildTrackedShow } from '../utils/buildTrackedShow';
import { ShowResultRow } from '../components/ShowResultRow';
import { Spinner } from '../components/Spinner';

function resultKey(r: SearchResult): string {
  return `${r.source}-${r.sourceId}`;
}

/** Browse overlay opened by tapping a genre chip on a show's detail
 * screen — lists other shows in that genre (TMDB or AniList, matching
 * the tapped show's own source; see getShowsByGenre), most popular
 * first — that's the order the API already returns them in, so no
 * client-side re-sort is needed. Each row still shows its own rating
 * (TMDB vote_average / AniList averageScore, not the real OMDb/IMDb
 * rating — that would mean an extra OMDb lookup per result just to
 * display a number this response already carries for free), just no
 * longer used to order the list — a plain rating sort surfaced obscure,
 * barely-voted shows above ones people actually know, which read as
 * "random" results for a browse screen.
 *
 * Mutually exclusive with ShowDetailScreen/SearchResultsScreen — only
 * one of these overlay screens is ever mounted at a time (see
 * pushOverlay/popOverlay in the store), so they can all share the same
 * z-index. Opening a result pushes it onto the overlay history rather
 * than just replacing it, so the back button returns here instead of
 * exiting straight past it. */
export function GenreScreen() {
  const selectedGenre = useAppStore((s) => s.selectedGenre);
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
    if (!selectedGenre) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setResults([]);

    getShowsByGenre(selectedGenre.source, selectedGenre.name)
      .then((fetched) => {
        if (cancelled) return;
        setResults(fetched);
        if (fetched.length === 0) setError('No shows found for this genre.');
      })
      .catch((err) => {
        console.error('Failed to fetch shows by genre:', err);
        if (!cancelled) setError('Failed to load shows. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedGenre]);

  if (!selectedGenre) return null;

  function existingTrackedShow(result: SearchResult) {
    return shows.find((s) => s.source === result.source && s.sourceId === result.sourceId);
  }

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

  async function handleOpenDetails(result: SearchResult) {
    const existing = existingTrackedShow(result);
    if (existing) {
      // pushOverlay records this genre screen as a restore point, so
      // the back button returns here instead of exiting straight past
      // it to whatever was open before the genre chip was tapped.
      pushOverlay({ selectedShowId: existing.id });
      return;
    }
    const key = `${result.source}-${result.sourceId}`;
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
          <h2 className="truncate text-sm font-semibold text-ink-100">{selectedGenre.name}</h2>
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
                return (
                  <ShowResultRow
                    key={key}
                    result={result}
                    tracked={!!existing}
                    isAdding={addingId === key}
                    isOpening={openingId === key}
                    hasOpenError={openErrorKey === key}
                    knownRating={result.rating ?? null}
                    ratingSource={result.source}
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

