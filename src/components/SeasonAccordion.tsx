import { useEffect, useRef, useState } from 'react';
import type { EpisodeInfo, SeasonSummary, TrackedShow } from '../types/show';
import { getSeasonEpisodes } from '../api/search';
import { isEpisodeWatched, isSeasonFullyWatched, getNextEpisode, getEpisodeWatchCount } from '../utils/progress';
import { useAppStore } from '../store/store';
import { ImageLightbox } from './ImageLightbox';

interface Props {
  show: TrackedShow;
  season: SeasonSummary;
  onEpisodeCheckboxClick: (season: number, episode: number) => void;
  onToggleSeason: (season: number) => void;
  /** Force this season open (e.g. deep-linked from Watch History)
   * instead of waiting for the user to tap it. */
  autoExpand?: boolean;
  /** When this season is (auto-)expanded, scroll this episode's row
   * into view and briefly highlight it. */
  focusEpisode?: number;
}

export function SeasonAccordion({
  show,
  season,
  onEpisodeCheckboxClick,
  onToggleSeason,
  autoExpand,
  focusEpisode,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [episodes, setEpisodes] = useState<EpisodeInfo[] | null>(season.episodes ?? null);
  const [loading, setLoading] = useState(false);
  const focusedRowRef = useRef<HTMLDivElement>(null);
  const [justFocused, setJustFocused] = useState(false);
  // Index into episodeImages (below) of the still currently open
  // full-screen, null when closed.
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const cacheSeasonEpisodes = useAppStore((s) => s.cacheSeasonEpisodes);
  const seasonWatched = isSeasonFullyWatched(show, season.season);
  const next = getNextEpisode(show);

  // Stills for the full-screen viewer, in episode order — only
  // episodes that actually have one (AniList/anime episodes never do).
  const episodeImages = (episodes ?? [])
    .filter((ep): ep is EpisodeInfo & { imageUrl: string } => !!ep.imageUrl)
    .map((ep) => ep.imageUrl);

  async function expand() {
    setExpanded(true);

    if (episodes === null) {
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
      return;
    }

    // Episodes cached before per-episode stills were added won't have
    // `imageUrl` even for TMDB shows that do have them. If none of the
    // cached episodes have one, silently recheck once — if fresher
    // data has images, swap it in. No loading state: this is a quiet
    // correction, not the initial fetch.
    if (show.source === 'tmdb' && episodes.length > 0 && episodes.every((ep) => !ep.imageUrl)) {
      try {
        const eps = await getSeasonEpisodes(show.source, show.sourceId, season.season);
        if (eps.some((ep) => ep.imageUrl)) {
          setEpisodes(eps);
          cacheSeasonEpisodes(show.id, season.season, eps);
        }
      } catch (err) {
        console.error('Failed to refresh episode images:', err);
      }
    }
  }

  async function toggle() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    await expand();
  }

  useEffect(() => {
    if (autoExpand && !expanded) expand();
    // Only reacting to autoExpand turning on, not to `expanded` itself
    // (which would re-trigger every time the user manually collapses).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoExpand]);

  // Once the focused episode's row actually exists (season expanded,
  // episodes loaded), scroll it into view and briefly highlight it.
  useEffect(() => {
    if (focusEpisode == null || !expanded || loading || !focusedRowRef.current) return;
    focusedRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setJustFocused(true);
    const timeout = setTimeout(() => setJustFocused(false), 1500);
    return () => clearTimeout(timeout);
  }, [focusEpisode, expanded, loading, episodes]);

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
          className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full transition-colors active:scale-95 ${
            seasonWatched ? 'bg-ok-500' : 'bg-white hover:bg-ink-200'
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            className={`h-5 w-5 ${seasonWatched ? 'text-white' : 'text-ink-600'}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          >
            <path d="M4 12.5L9.5 18L20 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {expanded && (
        // Left/top/bottom padding removed to give episode stills more
        // room. (Was `px-1 py-1`.)
        <div className="border-t border-ink-800 pr-1">
          {loading && <p className="px-2 py-2 text-xs text-ink-400">Loading episodes…</p>}
          {!loading &&
            episodes?.map((ep, idx) => {
              const watched = isEpisodeWatched(show, season.season, ep.episode);
              const watchCount = getEpisodeWatchCount(show, season.season, ep.episode);
              const isNext = next?.season === season.season && next?.episode === ep.episode;
              const isLast = idx === episodes.length - 1;
              const isFocused = focusEpisode === ep.episode;
              // Index of this episode's still among just the episodes
              // that have one — matches episodeImages below, so
              // opening the lightbox here and swiping through it walks
              // the stills in the same order as the episode list.
              const imageIndex = episodeImages.indexOf(ep.imageUrl ?? '');
              return (
                <div
                  key={`${ep.season}-${ep.episode}`}
                  ref={isFocused ? focusedRowRef : undefined}
                  className={`flex w-full items-stretch gap-2 overflow-hidden text-left text-xs transition-colors ${
                    show.source !== 'tmdb' || !ep.imageUrl ? 'pl-2' : ''
                  } ${isFocused && justFocused ? 'bg-signal-500/20' : isNext ? 'bg-ink-800/60' : ''}`}
                >
                  {show.source === 'tmdb' && ep.imageUrl && (
                    // Was `h-16 w-28` before sizing these up. Last row
                    // gets a rounded bottom-left corner to match the
                    // season card's own rounded-lg corner behind it.
                    <button
                      type="button"
                      onClick={() => setLightboxIndex(imageIndex)}
                      className={`h-24 w-40 flex-shrink-0 self-stretch ${isLast ? 'rounded-bl-lg' : ''}`}
                    >
                      <img
                        src={ep.imageUrl}
                        alt=""
                        className={`h-full w-full object-cover ${isLast ? 'rounded-bl-lg' : ''}`}
                      />
                    </button>
                  )}
                  <span className="flex-shrink-0 self-center py-2.5 text-ink-400">
                    E{ep.episode}
                  </span>
                  <span className="min-w-0 flex-1 self-center truncate py-2.5 pr-2 text-ink-200">
                    {ep.title || `Episode ${ep.episode}`}
                  </span>
                  {isNext && !watched && (
                    <span className="flex-shrink-0 self-center pr-2 text-xs text-signal-500">next</span>
                  )}
                  <button
                    onClick={() => onEpisodeCheckboxClick(season.season, ep.episode)}
                    aria-label={
                      watched
                        ? `Watched ${watchCount > 1 ? `${watchCount} times` : 'once'} — tap to change`
                        : 'Mark episode watched'
                    }
                    className={`relative my-2 mr-2 flex h-11 w-11 flex-shrink-0 items-center justify-center self-center rounded-full transition-colors active:scale-95 ${
                      watched ? 'bg-ok-500' : 'bg-white hover:bg-ink-200'
                    }`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className={`h-4 w-4 ${watched ? 'text-white' : 'text-ink-600'}`}
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

      {lightboxIndex !== null && (
        <ImageLightbox
          images={episodeImages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
