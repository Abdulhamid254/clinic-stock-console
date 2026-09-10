import { describe, it, expect, vi } from 'vitest';
import { TokenRefreshCoordinator } from '@/lib/token-refresh';

describe('TokenRefreshCoordinator', () => {
  it('collapses concurrent refresh requests into a single underlying call', async () => {
    let resolveRefresh: (v: { accessToken: string; refreshToken: string }) => void;
    const pending = new Promise<{ accessToken: string; refreshToken: string }>((res) => {
      resolveRefresh = res;
    });
    const performRefresh = vi.fn().mockReturnValue(pending);
    const coordinator = new TokenRefreshCoordinator(performRefresh);

    // Simulate 5 widgets hitting a 401 at the same moment.
    const results = Promise.all([
      coordinator.refresh(),
      coordinator.refresh(),
      coordinator.refresh(),
      coordinator.refresh(),
      coordinator.refresh(),
    ]);

    expect(performRefresh).toHaveBeenCalledTimes(1);

    resolveRefresh!({ accessToken: 'new-access', refreshToken: 'new-refresh' });
    const resolved = await results;

    expect(coordinator.refreshCallCount).toBe(1);
    resolved.forEach((r) => {
      expect(r.accessToken).toBe('new-access');
    });
  });

  it('allows a new refresh after the previous one has settled', async () => {
    const performRefresh = vi
      .fn()
      .mockResolvedValueOnce({ accessToken: 'a1', refreshToken: 'r1' })
      .mockResolvedValueOnce({ accessToken: 'a2', refreshToken: 'r2' });
    const coordinator = new TokenRefreshCoordinator(performRefresh);

    const first = await coordinator.refresh();
    const second = await coordinator.refresh();

    expect(performRefresh).toHaveBeenCalledTimes(2);
    expect(first.accessToken).toBe('a1');
    expect(second.accessToken).toBe('a2');
  });

  it('propagates failure to all waiting callers and allows retry afterward', async () => {
    const performRefresh = vi
      .fn()
      .mockRejectedValueOnce(new Error('refresh failed'))
      .mockResolvedValueOnce({ accessToken: 'a2', refreshToken: 'r2' });
    const coordinator = new TokenRefreshCoordinator(performRefresh);

    await expect(Promise.all([coordinator.refresh(), coordinator.refresh()])).rejects.toThrow(
      'refresh failed',
    );
    expect(performRefresh).toHaveBeenCalledTimes(1);

    const retry = await coordinator.refresh();
    expect(retry.accessToken).toBe('a2');
    expect(performRefresh).toHaveBeenCalledTimes(2);
  });
});
