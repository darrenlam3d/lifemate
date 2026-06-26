import { useEffect, useState } from 'react';

/**
 * Returns a Date that re-renders on an interval. Useful for live clocks and
 * "next event in X minutes" displays.
 */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
