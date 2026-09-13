'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';

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
      {isOnline
        ? 'Back online'
        : "You're offline — changes won't save until connection is restored"}
    </div>
  );
}
