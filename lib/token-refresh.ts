export type RefreshResult = {
  accessToken: string;
  refreshToken: string;
};

export type PerformRefresh = () => Promise<RefreshResult>;

export class TokenRefreshCoordinator {
  private inFlight: Promise<RefreshResult> | null = null;
  private callCount = 0;

  constructor(private readonly performRefresh: PerformRefresh) {}

  get refreshCallCount(): number {
    return this.callCount;
  }

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
