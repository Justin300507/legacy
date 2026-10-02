import { useEffect, useState } from 'react';

const SMALL = '(max-width: 640px)';

export function useIsSmall() {
  const [small, setSmall] = useState(() => window.matchMedia(SMALL).matches);
  useEffect(() => {
    const mq = window.matchMedia(SMALL);
    const on = () => setSmall(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return small;
}

export function useObjectUrl(blob: Blob | undefined) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) return setUrl(undefined);
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

/** True once `performance.now()` passes `at`. */
export function useReachedTime(at: number) {
  const [reached, setReached] = useState(() => performance.now() >= at);
  useEffect(() => {
    const wait = at - performance.now();
    if (wait <= 0) return setReached(true);
    setReached(false);
    const t = setTimeout(() => setReached(true), wait);
    return () => clearTimeout(t);
  }, [at]);
  return reached;
}

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';
