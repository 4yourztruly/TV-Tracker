import { Home, Search, Settings } from 'lucide-react';
import type { Tab } from '../store/store';
import { useAppStore } from '../store/store';

const TABS: { id: Tab; label: string; Icon: typeof Home }[] = [
  { id: 'home', label: 'Home', Icon: Home },
  { id: 'search', label: 'Search', Icon: Search },
  { id: 'settings', label: 'Settings', Icon: Settings },
];

export function TabBar() {
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const resetSearchTab = useAppStore((s) => s.resetSearchTab);

  return (
    <nav
      className="sticky bottom-0 z-10 flex border-t border-ink-800 bg-ink-950/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {TABS.map(({ id, label, Icon }) => {
        const isActive = id === activeTab;
        return (
          <button
            key={id}
            onClick={() => {
              if (id === 'search' && activeTab === 'search') resetSearchTab();
              setActiveTab(id);
            }}
            className={`flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors ${
              isActive ? 'text-signal-500' : 'text-ink-400 hover:text-ink-200'
            }`}
          >
            <Icon className="h-6 w-6" strokeWidth={isActive ? 2.25 : 1.75} aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
