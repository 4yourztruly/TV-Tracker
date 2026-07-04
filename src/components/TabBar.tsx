import type { Tab } from '../store/store';
import { useAppStore } from '../store/store';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'Home', icon: '\u25A6' },
  { id: 'search', label: 'Search', icon: '\u2315' },
  { id: 'settings', label: 'Settings', icon: '\u2699' },
];

export function TabBar() {
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  return (
    <nav className="sticky bottom-0 z-10 flex border-t border-ink-800 bg-ink-950/95 backdrop-blur">
      {TABS.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${
              isActive ? 'text-signal-500' : 'text-ink-400 hover:text-ink-200'
            }`}
          >
            <span className="text-lg leading-none" aria-hidden="true">
              {tab.icon}
            </span>
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
