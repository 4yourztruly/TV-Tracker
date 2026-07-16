import { SlidersHorizontal } from 'lucide-react';
import { useAppStore, type HomeSortBy } from '../store/store';

const SORT_OPTIONS: { value: HomeSortBy; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'rating', label: 'IMDb Rating' },
  { value: 'completion', label: 'Completion %' },
  { value: 'title', label: 'Title A–Z' },
];

/** Sort/filter bottom sheet for the Home screen grid, opened from the
 * floating sort button (see HomeSortFab). Both the sort choice and
 * genre selection apply live to the store as they're tapped — this
 * sheet is just a picker, not a form with its own draft state to
 * "apply". Mirrors ConfirmDialog's bottom-sheet shell/animation. */
export function HomeFilterSheet({ onDismiss }: { onDismiss: () => void }) {
  const shows = useAppStore((s) => s.shows);
  const homeSortBy = useAppStore((s) => s.homeSortBy);
  const setHomeSortBy = useAppStore((s) => s.setHomeSortBy);
  const homeGenreFilter = useAppStore((s) => s.homeGenreFilter);
  const toggleHomeGenreFilter = useAppStore((s) => s.toggleHomeGenreFilter);
  const setHomeGenreFilter = useAppStore((s) => s.setHomeGenreFilter);

  // Always includes Romance even if no currently-tracked show has it
  // yet, so it's pickable up front rather than only appearing once a
  // Romance show happens to get added.
  const genres = Array.from(new Set([...shows.flatMap((s) => s.genres ?? []), 'Romance'])).sort(
    (a, b) => a.localeCompare(b)
  );

  const hasActiveFilters = homeSortBy !== 'default' || homeGenreFilter.length > 0;

  function handleClearAll() {
    setHomeSortBy('default');
    setHomeGenreFilter([]);
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      style={{ animation: 'dialog-backdrop-in 0.2s ease' }}
      onClick={onDismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-[420px] flex-col gap-5 rounded-t-3xl border border-ink-800 bg-ink-900 p-6 shadow-2xl shadow-black/50 sm:rounded-2xl"
        style={{
          paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
          animation: 'dialog-sheet-in 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-signal-500/10 text-signal-500">
            <SlidersHorizontal className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
          </div>
          <h3 className="text-base font-semibold text-ink-100">Sort</h3>
        </div>

        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-400">Sort by</h4>
          <div className="flex flex-wrap gap-1.5">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setHomeSortBy(opt.value)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  homeSortBy === opt.value
                    ? 'bg-signal-500 text-ink-950'
                    : 'border border-ink-700 text-ink-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {genres.length > 0 && (
          <div className="flex flex-col gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-400">Genre</h4>
            <div className="flex flex-wrap gap-1.5">
              {genres.map((genre) => (
                <button
                  key={genre}
                  onClick={() => toggleHomeGenreFilter(genre)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    homeGenreFilter.includes(genre)
                      ? 'bg-signal-500 text-ink-950'
                      : 'border border-ink-700 text-ink-300'
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button
            onClick={onDismiss}
            className="min-h-12 w-full rounded-xl bg-signal-500 px-4 text-sm font-semibold text-ink-950 transition-colors hover:bg-signal-600 active:scale-[0.98]"
          >
            Done
          </button>
          {hasActiveFilters && (
            <button
              onClick={handleClearAll}
              className="min-h-12 w-full rounded-xl bg-ink-800 px-4 text-sm font-semibold text-ink-300 transition-colors hover:bg-ink-700 hover:text-ink-100 active:scale-[0.98]"
            >
              Clear all
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
