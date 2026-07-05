import { useState } from 'react';
import type { EpisodeInfo, SeasonSummary, TrackedShow } from '../types/show';
import { getSeasonEpisodes } from '../api/search';
import { isEpisodeWatched, isSeasonFullyWatched, getNextEpisode, getEpisodeWatchCount } from '../utils/progress';
import { useAppStore } from '../store/store';

interface Props {
  show: TrackedShow;
  season: SeasonSummary;
  onEpisodeCheckboxClick: (season: number, episode: number) => void;
  onToggleSeason: (season: number) => void;
}

export function SeasonAccordion({ show, season, onEpisodeCheckboxClick, onToggleSeason }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [episodes, setEpisodes] = useState<EpisodeInfo[] | null>(season.episodes ?? null);
  const [loading, setLoading] = useState(false);

  const cacheSeasonEpisodes = useAppStore((s) => s.cacheSeasonEpisodes);
  const seasonWatched = isSeasonFullyWatched(show, season.season);
  const next = getNextEpisode(show);

  async function toggle() {
    const next = !expanded;
    setExpanded(next);
    if (next && episodes === null) {
      setLoading(true);
      try {
        const eps = await getSeasonEpisodes(show.source, show.sourceId, season.season);
        setEpisodes(eps);
        cacheSeasonEpisodes(show.id, season.season, eps);
      } catch (err) {
        console.error('Failed to load episodes:', err);
        setEpisodes([]);
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <div className="rounded-lg border border-ink-800 bg-ink-900">
      <div className="flex items-center gap-1 px-2 py-2">
        <button
          onClick={toggle}
          className="flex min-h-12 flex-1 items-center justify-between rounded-lg px-2 text-left active:bg-ink-800/60"
        >
          <span className="text-sm font-medium text-ink-100">
            Season {season.season}
            <span className="ml-2 text-xs text-ink-400">{season.episodeCount} episodes</span>
          </span>
          <span className="ml-2 flex h-8 w-8 flex-shrink-0 items-center justify-center text-lg leading-none text-ink-400">
            {expanded ? '\u2212' : '+'}
          </span>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSeason(season.season);
          }}
          aria-label={seasonWatched ? 'Mark season unwatched' : 'Mark whole season watched'}
          className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors active:scale-95 ${
            seasonWatched
              ? 'border-ok-500 bg-ok-500/10 text-ok-500'
              : 'border-ink-600 text-ink-400 hover:border-signal-500 hover:text-signal-500'
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M4 12.5L9.5 18L20 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {expanded && (
        <div className="border-t border-ink-800 px-1 py-1">
          {loading && <p className="px-2 py-2 text-xs text-ink-400">Loading episodes…</p>}
          {!loading &&
            episodes?.map((ep) => {
              const watched = isEpisodeWatched(show, season.season, ep.episode);
              const watchCount = getEpisodeWatchCount(show, season.season, ep.episode);
              const isNext = next?.season === season.season && next?.episode === ep.episode;
              return (
                <div
                  key={`${ep.season}-${ep.episode}`}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-2.5 text-left text-xs ${
                    isNext ? 'bg-ink-800/60' : ''
                  }`}
                >
                  <span className="w-8 flex-shrink-0 text-ink-400">E{ep.episode}</span>
                  <span className="min-w-0 flex-1 truncate text-ink-200">
                    {ep.title || `Episode ${ep.episode}`}
                  </span>
                  {isNext && !watched && (
                    <span className="flex-shrink-0 text-xs text-signal-500">next</span>
                  )}
                  <button
                    onClick={() => onEpisodeCheckboxClick(season.season, ep.episode)}
                    aria-label={
                      watched
                        ? `Watched ${watchCount > 1 ? `${watchCount} times` : 'once'} — tap to change`
                        : 'Mark episode watched'
                    }
                    className={`relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors active:scale-95 ${
                      watched
                        ? 'border-ok-500 bg-ok-500/10 text-ok-500'
                        : 'border-ink-600 text-ink-400 hover:border-signal-500 hover:text-signal-500'
                    }`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <path d="M4 12.5L9.5 18L20 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {watchCount > 1 && (
                      <span className="absolute -bottom-1 -right-1 rounded-full bg-signal-500 px-1 text-[10px] font-bold leading-tight text-ink-950">
                        {watchCount}×
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
