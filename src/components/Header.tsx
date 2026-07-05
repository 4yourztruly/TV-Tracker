import { LayoutGrid, List } from 'lucide-react';
import { useAppStore } from '../store/store';

export function Header() {
  const activeTab = useAppStore((s) => s.activeTab);
  const homeViewMode = useAppStore((s) => s.homeViewMode);
  const setHomeViewMode = useAppStore((s) => s.setHomeViewMode);
  const isGrid = homeViewMode === 'grid';

  return (
    <header
      className="sticky top-0 z-10 flex items-center border-b border-ink-800 bg-ink-950/95 px-2 backdrop-blur"
      style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))', paddingBottom: '0.75rem' }}
    >
      {/* Spacer that mirrors the button's width so the title stays
          visually centered whether or not the button is shown. Fixed
          height (not just width) so the header is the same total height
          on every tab — otherwise tabs without a right-side button (or
          the empty state before it renders) collapse to the text's
          line-height and the whole bar visibly shifts. */}
      <div className="h-11 w-11 flex-shrink-0" aria-hidden="true" />
      <h1 className="flex-1 text-center font-[var(--font-display)] text-lg font-semibold tracking-tight text-ink-100">
        TV Tracker
      </h1>
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center">
        {activeTab === 'home' && (
          <button
            onClick={() => setHomeViewMode(isGrid ? 'list' : 'grid')}
            aria-label={isGrid ? 'Switch to list view' : 'Switch to grid view'}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100"
          >
            {isGrid ? <List className="h-5 w-5" /> : <LayoutGrid className="h-5 w-5" />}
          </button>
        )}
      </div>
    </header>
  );
}
