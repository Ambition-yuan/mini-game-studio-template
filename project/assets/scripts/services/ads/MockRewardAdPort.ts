import {
  RewardAdPort,
  RewardAdResult,
  RewardReason
} from './RewardAdPort';

export interface MockRewardAdConfig {
  readonly available?: boolean;
  readonly result?: RewardAdResult;
}

export class MockRewardAdPort implements RewardAdPort {
  private available: boolean;
  private result: RewardAdResult;
  private readonly availabilityChecks: RewardReason[] = [];
  private readonly shownReasons: RewardReason[] = [];

  constructor(config: MockRewardAdConfig = {}) {
    this.available = config.available ?? true;
    this.result = config.result ?? 'completed';
  }

  setAvailable(available: boolean): void {
    this.available = available;
  }

  setResult(result: RewardAdResult): void {
    this.result = result;
  }

  getAvailabilityChecks(): readonly RewardReason[] {
    return [...this.availabilityChecks];
  }

  getShownReasons(): readonly RewardReason[] {
    return [...this.shownReasons];
  }

  async isAvailable(reason: RewardReason): Promise<boolean> {
    this.availabilityChecks.push(reason);
    return this.available;
  }

  async show(reason: RewardReason): Promise<RewardAdResult> {
    this.shownReasons.push(reason);
    if (!this.available) {
      return 'unavailable';
    }
    return this.result;
  }
}
