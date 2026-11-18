import { useEffect, useState } from 'react';

const CLOCK_TICK_MS = 60_000;

/** L'heure est un état : la lire pendant le rendu le rendrait impur, et « il y a 2 min » ne vieillirait pas. */
export function useMinuteClock(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}
