export type WatchStatus = 'unwatched' | 'watching' | 'completed';

export type ShowSource = 'tmdb' | 'jikan';

export type SeriesStatus = 'ended' | 'ongoing' | 'unknown';

export interface EpisodeInfo {
  season: number;
  episode: number;
  title?: string;
  airdate?: string;
  /** Episode still/thumbnail image, when the source provides one.
   * TMDB does (per-episode "still"); Jikan/MAL's episode list doesn't,
   * so anime episodes won't have one. */
  imageUrl?: string;
  /** TMDB's own classification of the episode within its season —
   * "finale" is the last episode of ANY season (not just the series'
   * last one), so telling a season finale from a series finale means
   * also checking whether this is the show's last known season. Jikan
   * has no equivalent concept, so anime episodes never have this. */
  episodeType?: 'mid_season' | 'finale';
}

/** Bumped whenever the episode-fetching logic starts capturing a field
 * that older cached `EpisodeInfo[]` won't have (e.g. `episodeType`).
 * A season's cache is considered stale if its `episodesVersion` isn't
 * this, triggering a silent one-time refetch instead of permanently
 * showing incomplete data for shows cached under an older version. */
export const CURRENT_EPISODES_VERSION = 2;

export interface SeasonSummary {
  season: number;
  episodeCount: number;
  episodes?: EpisodeInfo[]; // populated lazily when the season is expanded
  episodesVersion?: number;
}

export interface TrackedShow {
  id: string; // internal uuid
  source: ShowSource;
  sourceId: number;
  title: string;
  summary?: string;
  posterUrl?: string;
  status: WatchStatus;

  /** Watch count per episode, keyed as "season-episode" (e.g. "2-14").
   * A count rather than a plain watched/unwatched flag, so rewatching
   * an episode can be tracked (2x, 3x, ...) instead of collapsing back
   * to "watched". A key's absence (or a count of 0) means unwatched;
   * any count >= 1 means watched, with the count feeding total watch
   * time in Settings > Stats. Stored as a plain object for simple JSON
   * serialization to Drive. */
  watchedEpisodes: Record<string, number>;

  /** Log of episodes marked watched via the Home screen's quick-watch
   * checkmark specifically (not episode/season toggles from the
   * detail screen), oldest first. Powers the Home screen's Watch
   * History section — every home-screen watch gets its own entry, so
   * watching episodes 1, 2, 3 back to back shows all three, not just
   * the latest. Unwatching via the home screen's swipe gesture removes
   * the matching entry rather than adding one. */
  watchHistory?: { season: number; episode: number; watchedAt: number }[];

  /** Total known episode count. May be null for ongoing anime with an
   * unknown final count (Jikan can return null). */
  totalEpisodes: number | null;

  /** Whether the real-world series is finished or still expected to
   * continue. Used to distinguish "Completed" from "Up to date" when
   * all currently-known episodes are watched. */
  seriesStatus?: SeriesStatus;
  seriesStatusUpdatedAt?: number;
  seriesStatusVersion?: number;

  /** Average episode runtime in minutes, when the source API reports
   * one. Used to estimate total watch time in Settings > Stats. */
  episodeRuntimeMinutes?: number;

  /** Genre names, when the source API reports them. */
  genres?: string[];

  /** IMDb rating (e.g. "8.4"), fetched once when the show is added and
   * cached here so it isn't re-fetched from OMDb every time the show
   * is viewed. `undefined` means never checked (e.g. tracked before
   * this field existed); `null` means checked and OMDb had no rating
   * for it — both are backfilled/left alone rather than retried. */
  imdbRating?: string | null;

  /** Content/age rating (e.g. "TV-MA", "R"), when the source API
   * reports one. Same undefined-vs-null convention as `imdbRating`. */
  ageRating?: string | null;

  /** Backdrop/preview images for the show (TMDB only — Jikan has no
   * equivalent gallery), shown as a photo strip in the detail view.
   * Same undefined-vs-null-ish convention as `genres`: undefined means
   * never checked, an empty array means checked and none available. */
  backdropUrls?: string[];

  seasons: SeasonSummary[];

  notes?: string;
  addedAt: number;
  updatedAt: number;
}

/** Lightweight shape returned by search, before a show is added to the list. */
export interface SearchResult {
  source: ShowSource;
  sourceId: number;
  title: string;
  posterUrl?: string;
  summary?: string;
  year?: string;
}

/** Shape of the JSON blob synced to the Google Drive appData folder. */
export interface TrackerData {
  version: 1;
  shows: TrackedShow[];
}
