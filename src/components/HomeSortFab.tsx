import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { useAppStore } from '../store/store';
import { HomeFilterSheet } from './HomeFilterSheet';

/** Floating "Sort & filter" button for the Home screen's grid view —
 * only shown there (not the list view, which has no need for it and
 * would otherwise cover the Watch History rows at the bottom).
 * Positioned above the tab bar's center (Search) tab: `fixed` +
 * `left-1/2 -translate-x-1/2` centers it on the viewport rather than
 * any particular ancestor, which lines up correctly with the app
 * shell's own centered column regardless of screen width, since that
 * column is itself centered the same way (see App.tsx). */
export function HomeSortFab() {
  const activeTab = useAppStore((s) => s.activeTab);
  const homeViewMode = useAppStore((s) => s.homeViewMode);
  const homeSortBy = useAppStore((s) => s.homeSortBy);
  const homeGenreFilter = useAppStore((s) => s.homeGenreFilter);
  const isActive = homeSortBy !== 'default' || homeGenreFilter.length > 0;

  const [sheetOpen, setSheetOpen] = useState(false);

  if (activeTab !== 'home' || homeViewMode !== 'grid') return null;

  return (
    <>
      <button
        onClick={() => setSheetOpen(true)}
        aria-label="Sort"
        className={`fixed left-1/2 z-15 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full shadow-lg shadow-black/40 transition-colors active:scale-95 ${
          isActive
            ? 'bg-signal-500 text-ink-950'
            : 'border border-ink-700 bg-ink-900 text-ink-200 hover:border-ink-600'
        }`}
        style={{ bottom: 'calc(4.75rem + env(safe-area-inset-bottom))' }}
      >
        <SlidersHorizontal className="h-6 w-6" />
      </button>
      {sheetOpen && <HomeFilterSheet onDismiss={() => setSheetOpen(false)} />}
    </>
  );
}
