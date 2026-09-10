'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getAccessToken, getRefreshToken } from '@/lib/api-client';
import { useMe } from '@/lib/queries/auth';
import type { AuthUser } from '@/lib/types';

interface AuthContextValue {
  user: AuthUser | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: undefined,
  isLoading: true,
  isAuthenticated: false,
});

const PUBLIC_ROUTES = ['/login'];

/**
 * App-load hydration: we never persist the access token itself across a hard
 * reload (see api-client.ts decision note), only the refresh token. So on
 * mount, if we have a refresh token but no in-memory access token yet, this
 * provider is responsible for restoring the session before route guards
 * decide whether to bounce the user to /login.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Nothing to restore beyond marking ourselves hydrated: if there's no
    // access token but a refresh token exists in sessionStorage, the very
    // first apiFetch('/auth/me') call below will get a 401 (missing/invalid
    // bearer token), which triggers api-client's existing refresh-and-retry
    // path using that stored refresh token. No special-casing needed here.
    setHydrated(true);
  }, []);

  const isPublic = PUBLIC_ROUTES.includes(pathname);
  const canAttemptSession = !!getAccessToken() || !!getRefreshToken();
  const { data: user, isLoading, isError } = useMe(hydrated && canAttemptSession);

  useEffect(() => {
    if (!hydrated || isLoading || isPublic) return;
    if (isError || !canAttemptSession) {
      const next = encodeURIComponent(pathname);
      router.replace(`/login?next=${next}`);
    }
  }, [hydrated, isLoading, isError, isPublic, canAttemptSession, pathname, router]);

  return (
    <AuthContext.Provider value={{ user, isLoading: !hydrated || isLoading, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
