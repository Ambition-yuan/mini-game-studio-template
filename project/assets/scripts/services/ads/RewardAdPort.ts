export type RewardReason =
  | 'UNLOCK_BUFFER'
  | 'UNDO'
  | 'SHUFFLE';

export type RewardAdResult =
  | 'completed'
  | 'skipped'
  | 'unavailable'
  | 'failed';

export interface RewardAdPort {
  isAvailable(reason: RewardReason): Promise<boolean>;
  show(reason: RewardReason): Promise<RewardAdResult>;
}
