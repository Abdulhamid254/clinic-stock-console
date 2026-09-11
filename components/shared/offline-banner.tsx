'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';

/**
 * Tracks the browser's online/offline state. Ward tablets are explicitly
 * described as being on patchy wifi, so a visible banner while offline (and
 * a brief confirmation on reconnect) matters more here than in a typical
 * app — silently failing requests would otherwise look identical to "the
 * save worked, nothing to see."
 */
export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [justReconnected, setJustReconnected] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    setIsOnline(navigator.onLine);

    function handleOnline() {
      setIsOnline(true);
      setJustReconnected(true);
      showToast('Back online', 'success');
      setTimeout(() => setJustReconnected(false), 3000);
    }
    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally
    // running once on mount only: showToast is stable for the life of the
    // provider, and re-subscribing these listeners on every render would be
    // wasteful for no behavioural difference.
  }, []);

  if (isOnline && !justReconnected) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={
        isOnline
          ? 'bg-emerald-600 px-4 py-1.5 text-center text-sm text-white'
          : 'bg-amber-600 px-4 py-1.5 text-center text-sm text-white'
      }
    >
      {isOnline ? 'Back online' : "You're offline — changes won't save until connection is restored"}
    </div>
  );
}
