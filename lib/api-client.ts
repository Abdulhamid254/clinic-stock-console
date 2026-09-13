import { TokenRefreshCoordinator, type RefreshResult } from './token-refresh';

const BASE_URL = 'https://dummyjson.com';

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

const REFRESH_TOKEN_KEY = 'clinic-stock-refresh-token';

export function setRefreshToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) {
    window.sessionStorage.setItem(REFRESH_TOKEN_KEY, token);
  } else {
    window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(REFRESH_TOKEN_KEY);
}

export function clearSession() {
  setAccessToken(null);
  setRefreshToken(null);
}

// --- Refresh coordinator -------------------------------------------------

async function performRefresh(): Promise<RefreshResult> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }
  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken, expiresInMins: 1 }),
  });
  if (!res.ok) {
    throw new Error('Refresh failed');
  }
  const data = await res.json();
  setAccessToken(data.accessToken);
  setRefreshToken(data.refreshToken);
  return { accessToken: data.accessToken, refreshToken: data.refreshToken };
}

const coordinator = new TokenRefreshCoordinator(performRefresh);

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class AuthExpiredError extends Error {
  constructor(public next: string) {
    super('Session expired');
    this.name = 'AuthExpiredError';
  }
}

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

/**
 * Fetch wrapper: attaches the bearer token, and on a single 401 transparently
 * refreshes (via the shared coordinator, so concurrent 401s collapse into one
 * refresh call) and retries the original request exactly once. If the refresh
 * itself fails, throws AuthExpiredError so the caller can redirect to /login
 * while preserving the current URL.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const doFetch = async (): Promise<Response> => {
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
    if (!options.skipAuth && accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }
    return fetch(`${BASE_URL}${path}`, { ...options, headers });
  };

  let res = await doFetch();

  if (res.status === 401 && !options.skipAuth) {
    try {
      await coordinator.refresh();
    } catch {
      const next =
        typeof window !== 'undefined'
          ? window.location.pathname + window.location.search
          : '/stock';
      clearSession();
      throw new AuthExpiredError(next);
    }
    res = await doFetch();
  }

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export { coordinator as tokenRefreshCoordinator };
