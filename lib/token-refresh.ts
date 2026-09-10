/**
 * Pure, framework-free token-refresh coordinator.
 *
 * The problem: several widgets can each get a 401 at roughly the same moment
 * (e.g. after the 1-minute DummyJSON token expiry). If each one independently
 * calls the refresh endpoint, we fire N refresh requests and may end up with
 * mismatched tokens depending on response ordering. This module guarantees
 * that no matter how many callers ask for a refresh concurrently, only ONE
 * network call is in flight at a time, and everyone awaits the same promise.
 *
 * It knows nothing about fetch, React, or storage — it's injected a
 * `performRefresh` function, which makes it trivial to unit test.
 */

export type RefreshResult = {
  accessToken: string;
  refreshToken: string;
};

export type PerformRefresh = () => Promise<RefreshResult>;

export class TokenRefreshCoordinator {
  private inFlight: Promise<RefreshResult> | null = null;
  private callCount = 0;

  constructor(private readonly performRefresh: PerformRefresh) {}

  /**
   * Returns the number of times the underlying performRefresh function has
   * actually been invoked. Exposed for tests.
   */
  get refreshCallCount(): number {
    return this.callCount;
  }

  /**
   * Request a token refresh. If a refresh is already in flight, this caller
   * is attached to that same promise instead of starting a new one.
   */
  async refresh(): Promise<RefreshResult> {
    if (this.inFlight) {
      return this.inFlight;
    }

    this.callCount += 1;
    const promise = this.performRefresh().finally(() => {
      // Only clear once this exact call settles, so a new refresh can be
      // requested after this one finishes (success or failure).
      if (this.inFlight === promise) {
        this.inFlight = null;
      }
    });

    this.inFlight = promise;
    return promise;
  }
}
