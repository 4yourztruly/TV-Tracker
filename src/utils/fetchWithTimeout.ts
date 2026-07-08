const DEFAULT_TIMEOUT_MS = 15000;

/** Thin wrapper around fetch() that aborts after a timeout instead of
 * hanging indefinitely — plain fetch() has no default timeout, so a
 * stalled/slow upstream would otherwise leave a "Loading…" state stuck
 * forever instead of failing visibly so the UI can show an error and
 * let the user retry. */
export function fetchWithTimeout(
  url: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  init?: RequestInit
): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}
