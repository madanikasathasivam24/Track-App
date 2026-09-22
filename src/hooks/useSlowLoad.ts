import { useEffect, useState } from 'react';

// Flips true once `active` has stayed true for `delayMs` — used to show a
// reassuring "still loading" message only once a wait has gone on long
// enough to look stuck (e.g. Track-api's Render free-tier cold start, see
// CLAUDE.md), rather than flashing it on every normal-speed load.
export function useSlowLoad(active: boolean, delayMs = 4000): boolean {
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    if (!active) {
      setIsSlow(false);
      return;
    }
    const timer = setTimeout(() => setIsSlow(true), delayMs);
    return () => clearTimeout(timer);
  }, [active, delayMs]);

  return isSlow;
}
