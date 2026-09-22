import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

// Module-level, not component state, so it survives a screen fully unmounting
// and remounting — the common case for stack-pushed screens (GroupDetails,
// Notifications, ...), which lose all local state every time you navigate
// away and back, unlike bottom-tab screens which React Navigation keeps
// mounted across tab switches.
const cache = new Map<string, unknown>();

// Shows the last successful result for `key` instantly on mount if there is
// one (no loading skeleton flash on a screen you've already visited this
// session), then always refetches quietly in the background on every focus,
// updating in place if anything changed. `isLoading` only ever reflects a key
// that's never resolved before. Assumes `key` is stable for the component's
// lifetime (a route param like groupId, or a fixed string) — it isn't watched
// for changes.
export function useStaleWhileRevalidate<T>(key: string, fetcher: () => Promise<T>) {
  const cached = cache.get(key) as T | undefined;
  const [data, setData] = useState<T | undefined>(cached);
  const [isLoading, setIsLoading] = useState(cached === undefined);
  const [error, setError] = useState<unknown>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const reload = useCallback(async () => {
    try {
      const result = await fetcherRef.current();
      cache.set(key, result);
      setData(result);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [key]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  return { data, setData, isLoading, error, reload };
}

// Same cache/instant-paint behavior, but for components that stay mounted
// and toggle a `visible`-style boolean instead of unmounting (e.g. a modal
// rendered unconditionally alongside its screen) — useFocusEffect only reacts
// to the screen's own focus, not to a prop like that flipping true, so this
// re-fetches on `trigger` instead. Shares the same module-level cache, so a
// key already resolved elsewhere paints instantly here too.
export function useStaleWhileRevalidateOn<T>(key: string, fetcher: () => Promise<T>, trigger: boolean) {
  const cached = cache.get(key) as T | undefined;
  const [data, setData] = useState<T | undefined>(cached);
  const [isLoading, setIsLoading] = useState(cached === undefined);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!trigger) return;
    let cancelled = false;
    fetcherRef
      .current()
      .then((result) => {
        if (cancelled) return;
        cache.set(key, result);
        setData(result);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [key, trigger]);

  return { data, setData, isLoading };
}
