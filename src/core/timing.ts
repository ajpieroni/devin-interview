// Runs fn and reports its wall time, for the "50 of 10,000, 42 ms" list footers.
export async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const t0 = performance.now();
  const value = await fn();
  return { value, ms: performance.now() - t0 };
}
