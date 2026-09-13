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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
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
    <AuthContext.Provider
      value={{ user, isLoading: !hydrated || isLoading, isAuthenticated: !!user }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
