/** Runs async tasks one at a time with a delay between each, so batch
 * operations (like refreshing episode counts for every tracked anime on
 * app load) don't burst past Jikan's ~3 req/sec rate limit. */
export async function runThrottled<T>(
  tasks: Array<() => Promise<T>>,
  delayMs = 350
): Promise<Array<PromiseSettledResult<T>>> {
  const results: Array<PromiseSettledResult<T>> = [];
  for (const task of tasks) {
    try {
      const value = await task();
      results.push({ status: 'fulfilled', value });
    } catch (reason) {
      results.push({ status: 'rejected', reason });
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return results;
}
