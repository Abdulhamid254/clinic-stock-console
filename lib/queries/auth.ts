import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, setAccessToken, setRefreshToken, clearSession } from '../api-client';
import type { AuthUser, LoginResponse } from '../types';
import type { LoginFormValues } from '../schemas';

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: LoginFormValues) => {
      return apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify({ ...values, expiresInMins: 1 }),
      });
    },
    onSuccess: (data) => {
      setAccessToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      queryClient.setQueryData(['auth', 'me'], {
        id: data.id,
        username: data.username,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        image: data.image,
      } satisfies AuthUser);
    },
  });
}

export function useMe(enabled: boolean) {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => apiFetch<AuthUser>('/auth/me'),
    enabled,
    retry: false,
    staleTime: Infinity,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return () => {
    clearSession();
    queryClient.clear();
  };
}
