import {
  getTopIndex,
  isCompletedMainShelf,
  isWon,
  moveTopGroup,
  openTopBox
} from '../domain/BoardRules';
import {
  BoardState,
  cloneBoard,
  createShelf
} from '../domain/BoardTypes';
import {
  LevelConfig,
  MVP_LEVELS
} from '../domain/LevelConfig';
import {
  GeneratedLevel,
  generateLevel
} from '../domain/LevelGenerator';
import {
  createDefaultSaveData,
  SaveDataV1,
  SaveLoadResult
} from '../../services/save/SaveData';
import { SavePort } from '../../services/save/SavePort';
import { MockRewardAdPort } from '../../services/ads/MockRewardAdPort';
import {
  RewardAdPort,
  RewardAdResult,
  RewardReason
} from '../../services/ads/RewardAdPort';

export interface GameSnapshot {
  readonly levelId: number;
  readonly levelTitle: string;
  readonly board: BoardState;
  readonly selectedShelfId: string | null;
  readonly message: string;
  readonly flowState: GameFlowState;
  readonly isWon: boolean;
  readonly isLastLevel: boolean;
  readonly isSettingsOpen: boolean;
  readonly selectedLevelTitle: string;
  readonly highestUnlockedLevel: number;
  readonly soundEnabled: boolean;
  readonly musicEnabled: boolean;
  readonly bufferShelfCount: number;
  readonly canUndo: boolean;
  readonly isRewardAdBusy: boolean;
}

export type GameFlowState = 'home' | 'playing' | 'levelComplete';

type SnapshotListener = (snapshot: GameSnapshot) => void;

const DEFAULT_BUFFER_COUNT = 2;
const BUFFER_SHELF_CAPACITY = 1;
const MAX_BUFFER_COUNT = 8;
const MAX_HISTORY = 100;

export class GameFlowController {
  private readonly levels: readonly LevelConfig[];
  private readonly savePort: SavePort | null;
  private readonly rewardAdPort: RewardAdPort;
  private readonly listeners = new Set<SnapshotListener>();
  private readonly history: BoardState[] = [];

  private config: LevelConfig;
  private generated: GeneratedLevel;
  private board: BoardState;
  private progress: SaveDataV1;
  private saveEnabled = false;
  private currentLevelIndex = 0;
  private flowState: GameFlowState = 'home';
  private settingsOpen = false;
  private selectedShelfId: string | null = null;
  private message = '准备开始游戏。';
  private bufferShelfCount = DEFAULT_BUFFER_COUNT;
  private seedOffset = 0;
  private rewardAdBusy = false;

  constructor(
    levels: readonly LevelConfig[] = MVP_LEVELS,
    savePort: SavePort | null = null,
    rewardAdPort: RewardAdPort = new MockRewardAdPort()
  ) {
    if (levels.length === 0) {
      throw new Error('At least one level is required.');
    }

    this.levels = levels;
    this.savePort = savePort;
    this.rewardAdPort = rewardAdPort;
    this.progress = createDefaultSaveData(levels.length);
    this.currentLevelIndex = this.getLevelIndex(this.progress.selectedLevel);
    this.config = levels[this.currentLevelIndex] as LevelConfig;
    this.generated = generateLevel(this.config, this.nextSeed());
    this.board = this.createBoardWithBuffers(
      this.generated.board,
      this.bufferShelfCount
    );
  }

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): GameSnapshot {
    return {
      levelId: this.config.id,
      levelTitle: `第 ${this.config.id} 关`,
      board: cloneBoard(this.board),
      selectedShelfId: this.selectedShelfId,
      message: this.message,
      flowState: this.flowState,
      isWon: isWon(this.board),
      isLastLevel: this.currentLevelIndex === this.levels.length - 1,
      isSettingsOpen: this.settingsOpen,
      selectedLevelTitle: this.getLevelTitle(this.progress.selectedLevel),
      highestUnlockedLevel: this.progress.highestUnlockedLevel,
      soundEnabled: this.progress.soundEnabled,
      musicEnabled: this.progress.musicEnabled,
      bufferShelfCount: this.bufferShelfCount,
      canUndo: this.history.length > 0,
      isRewardAdBusy: this.rewardAdBusy
    };
  }

  getLevelCount(): number {
    return this.levels.length;
  }

  restoreSaveData(result: SaveLoadResult): void {
    if (this.rewardAdBusy) {
      return;
    }

    this.progress = result.data;
    this.saveEnabled = result.canWrite;
    this.currentLevelIndex = this.getLevelIndex(this.progress.selectedLevel);
    this.config = this.levels[this.currentLevelIndex] as LevelConfig;
    this.generated = generateLevel(this.config, this.nextSeed());
    this.board = this.createBoardWithBuffers(
      this.generated.board,
      DEFAULT_BUFFER_COUNT
    );
    this.bufferShelfCount = DEFAULT_BUFFER_COUNT;
    this.history.length = 0;
    this.flowState = 'home';
    this.settingsOpen = false;
    this.selectedShelfId = null;
    this.rewardAdBusy = false;
    this.message = result.status === 'unsupported'
      ? '存档版本不受支持，本次进度不会覆盖原存档。'
      : '存档已载入。';
    this.publish();
  }

  startLevel(levelId: number): void {
    if (this.rewardAdBusy) {
      return;
    }

    const levelIndex = this.levels.findIndex((level) => level.id === levelId);
    const config = this.levels[levelIndex];
    if (!config || levelIndex < 0) {
      return;
    }

    this.currentLevelIndex = levelIndex;
    this.config = config;
    this.progress = {
      ...this.progress,
      selectedLevel: config.id
    };
    this.flowState = 'playing';
    this.settingsOpen = false;
    this.bufferShelfCount = DEFAULT_BUFFER_COUNT;
    this.generated = generateLevel(config, this.nextSeed());
    this.board = this.createBoardWithBuffers(
      this.generated.board,
      this.bufferShelfCount
    );
    this.history.length = 0;
    this.selectedShelfId = null;
    this.message = '点击货架顶部连续同类商品，再点击目标货架。';
    this.persist();
    this.publish();
  }

  goHome(): void {
    if (this.rewardAdBusy) {
      return;
    }

    this.flowState = 'home';
    this.settingsOpen = false;
    this.selectedShelfId = null;
    this.message = '已返回首页。';
    this.publish();
  }

  startCurrentLevel(): void {
    if (this.rewardAdBusy) {
      return;
    }

    const selectedIndex = this.getLevelIndex(this.progress.selectedLevel);
    this.seedOffset += 1;
    this.startLevel(this.levels[selectedIndex]?.id ?? this.config.id);
  }

  restart(): void {
    if (
      this.flowState === 'home' ||
      this.settingsOpen ||
      this.rewardAdBusy
    ) {
      return;
    }

    this.seedOffset += 1;
    this.startLevel(this.config.id);
  }

  openSettings(): void {
    if (
      this.flowState !== 'playing' ||
      this.settingsOpen ||
      this.rewardAdBusy
    ) {
      return;
    }

    this.settingsOpen = true;
    this.selectedShelfId = null;
    this.message = '设置已打开。';
    this.publish();
  }

  closeSettings(): void {
    if (!this.settingsOpen || this.rewardAdBusy) {
      return;
    }

    this.settingsOpen = false;
    this.message = '继续游戏。';
    this.publish();
  }

  toggleSound(): void {
    if (!this.settingsOpen || this.rewardAdBusy) {
      return;
    }

    this.progress = {
      ...this.progress,
      soundEnabled: !this.progress.soundEnabled
    };
    this.persist();
    this.publish();
  }

  toggleMusic(): void {
    if (!this.settingsOpen || this.rewardAdBusy) {
      return;
    }

    this.progress = {
      ...this.progress,
      musicEnabled: !this.progress.musicEnabled
    };
    this.persist();
    this.publish();
  }

  nextLevel(): void {
    if (this.rewardAdBusy) {
      return;
    }

    if (this.flowState !== 'levelComplete') {
      this.message = '完成当前关卡后才能进入下一关。';
      this.publish();
      return;
    }

    const nextConfig = this.levels[this.currentLevelIndex + 1];
    if (!nextConfig) {
      this.message = '已完成全部关卡。';
      this.publish();
      return;
    }

    this.startLevel(nextConfig.id);
  }

  tapShelf(shelfId: string): void {
    if (
      this.flowState !== 'playing' ||
      this.settingsOpen ||
      this.rewardAdBusy
    ) {
      return;
    }

    const shelf = this.board.shelves.find((candidate) => candidate.id === shelfId);
    if (!shelf || isWon(this.board)) {
      return;
    }

    const topIndex = getTopIndex(shelf);
    const top = topIndex >= 0 ? shelf.slots[topIndex] : null;

    if (top?.hidden) {
      this.commitBoardMutation(openTopBox(this.board, shelfId), '箱子已打开。');
      return;
    }

    if (!this.selectedShelfId) {
      if (!top) {
        this.message = '空货架只能作为移动目标。';
        this.publish();
        return;
      }
      if (isCompletedMainShelf(shelf)) {
        this.message = '已完成的货架不可操作。';
        this.publish();
        return;
      }
      this.selectedShelfId = shelfId;
      this.message = '已选择商品，请点击目标货架。';
      this.publish();
      return;
    }

    if (this.selectedShelfId === shelfId) {
      this.selectedShelfId = null;
      this.message = '已取消选择。';
      this.publish();
      return;
    }

    const moved = moveTopGroup(
      this.board,
      this.selectedShelfId,
      shelfId
    );
    if (!moved.ok) {
      this.message = this.describeMoveFailure(moved.reason);
      this.publish();
      return;
    }

    this.pushHistory();
    this.board = moved.board;
    this.selectedShelfId = null;
    const won = isWon(this.board);
    this.flowState = won ? 'levelComplete' : 'playing';
    if (won) {
      this.recordLevelCompletion();
    }
    this.message = won ? '整理完成。' : '已移动商品。';
    this.publish();
  }

  async undo(): Promise<void> {
    if (!this.canUseRewardAction()) {
      return;
    }

    if (this.history.length === 0) {
      this.message = '当前没有可撤回的操作。';
      this.publish();
      return;
    }

    await this.runReward('UNDO', () => {
      const previous = this.history.pop();
      if (!previous) {
        return;
      }

      this.board = cloneBoard(previous);
      this.selectedShelfId = null;
      this.message = '已撤回一步。';
      this.publish();
    });
  }

  async unlockBufferShelf(): Promise<void> {
    if (!this.canUseRewardAction()) {
      return;
    }

    if (this.bufferShelfCount >= MAX_BUFFER_COUNT) {
      this.message = '缓冲货架已达到上限。';
      this.publish();
      return;
    }

    await this.runReward('UNLOCK_BUFFER', () => {
      this.bufferShelfCount += 1;
      const next = cloneBoard(this.board);
      next.shelves.push(
        createShelf(
          `buffer-${this.bufferShelfCount}`,
          'buffer',
          BUFFER_SHELF_CAPACITY
        )
      );
      this.board = next;
      this.message = `已解锁第 ${this.bufferShelfCount} 个缓冲货架。`;
      this.publish();
    });
  }

  async shuffle(): Promise<void> {
    if (!this.canUseRewardAction()) {
      return;
    }

    let generated: GeneratedLevel | null = null;
    let selectedSeedOffset = 0;
    const currentLayout = this.getMainLayoutSignature(this.board);
    try {
      for (let offset = 1; offset <= 32; offset += 1) {
        const candidate = generateLevel(
          this.config,
          this.nextSeed() + offset
        );
        if (this.getMainLayoutSignature(candidate.board) !== currentLayout) {
          generated = candidate;
          selectedSeedOffset = offset;
          break;
        }
      }
    } catch {
      generated = null;
    }

    if (!generated) {
      this.message = '打乱生成失败，请重试。';
      this.publish();
      return;
    }

    await this.runReward('SHUFFLE', () => {
      this.seedOffset += selectedSeedOffset;
      this.generated = generated;
      this.flowState = 'playing';
      this.board = this.createBoardWithBuffers(
        this.generated.board,
        this.bufferShelfCount
      );
      this.history.length = 0;
      this.selectedShelfId = null;
      this.message = '已生成新的可解布局。';
      this.publish();
    });
  }

  private canUseRewardAction(): boolean {
    return (
      this.flowState === 'playing' &&
      !this.settingsOpen &&
      !this.rewardAdBusy
    );
  }

  private async runReward(
    reason: RewardReason,
    grantReward: () => void
  ): Promise<void> {
    if (!this.canUseRewardAction()) {
      return;
    }

    this.rewardAdBusy = true;
    this.message = '正在加载激励视频...';
    this.publish();

    let result: RewardAdResult = 'failed';
    try {
      const available = await this.rewardAdPort.isAvailable(reason);
      result = available
        ? await this.rewardAdPort.show(reason)
        : 'unavailable';
    } catch {
      result = 'failed';
    }

    this.rewardAdBusy = false;
    if (!this.canUseRewardAction()) {
      this.message = '奖励操作已取消。';
      this.publish();
      return;
    }

    if (result !== 'completed') {
      this.message = this.describeRewardResult(result);
      this.publish();
      return;
    }

    grantReward();
  }

  private describeRewardResult(result: Exclude<RewardAdResult, 'completed'>): string {
    switch (result) {
      case 'skipped':
        return '未完成激励视频，奖励未发放。';
      case 'unavailable':
        return '奖励广告暂不可用。';
      case 'failed':
        return '奖励广告播放失败。';
    }
  }

  private createBoardWithBuffers(
    source: BoardState,
    bufferCount: number
  ): BoardState {
    const next = cloneBoard(source);
    for (let index = 0; index < bufferCount; index += 1) {
      next.shelves.push(
        createShelf(
          `buffer-${index + 1}`,
          'buffer',
          BUFFER_SHELF_CAPACITY
        )
      );
    }
    return next;
  }

  private commitBoardMutation(
    result: ReturnType<typeof openTopBox>,
    successMessage: string
  ): void {
    if (!result.ok) {
      this.message = this.describeMoveFailure(result.reason);
      this.publish();
      return;
    }

    this.pushHistory();
    this.board = result.board;
    this.selectedShelfId = null;
    const won = isWon(this.board);
    this.flowState = won ? 'levelComplete' : 'playing';
    if (won) {
      this.recordLevelCompletion();
    }
    this.message = won ? '整理完成。' : successMessage;
    this.publish();
  }

  private pushHistory(): void {
    this.history.push(cloneBoard(this.board));
    if (this.history.length > MAX_HISTORY) {
      this.history.shift();
    }
  }

  private nextSeed(): number {
    return (this.config.generationSeed ?? this.config.id * 7919) + this.seedOffset;
  }

  private getMainLayoutSignature(board: BoardState): string {
    return board.shelves
      .filter((shelf) => shelf.kind === 'main')
      .map((shelf) => {
        const slots = shelf.slots
          .map((slot) => (
            slot
              ? `${slot.itemTypeId}:${slot.hidden ? 'hidden' : 'visible'}`
              : '-'
          ))
          .join(',');
        return `${shelf.id}:${slots}`;
      })
      .join('|');
  }

  private getLevelIndex(levelId: number): number {
    const levelIndex = this.levels.findIndex((level) => level.id === levelId);
    return levelIndex >= 0 ? levelIndex : 0;
  }

  private getLevelTitle(levelId: number): string {
    const level = this.levels[this.getLevelIndex(levelId)];
    return `第 ${level?.id ?? this.config.id} 关`;
  }

  private recordLevelCompletion(): void {
    const nextConfig = this.levels[this.currentLevelIndex + 1];
    const completedLevels = new Set(this.progress.completedLevels);
    completedLevels.add(this.config.id);

    this.progress = {
      ...this.progress,
      completedLevels: [...completedLevels].sort((left, right) => left - right),
      highestUnlockedLevel: Math.max(
        this.progress.highestUnlockedLevel,
        nextConfig?.id ?? this.config.id
      ),
      selectedLevel: nextConfig?.id ?? this.config.id
    };
    this.persist();
  }

  private persist(): void {
    if (!this.saveEnabled || !this.savePort) {
      return;
    }

    void this.savePort.save({
      ...this.progress,
      completedLevels: [...this.progress.completedLevels]
    }).catch(() => undefined);
  }

  private describeMoveFailure(reason: string): string {
    switch (reason) {
      case 'TARGET_TOP_TYPE_MISMATCH':
        return '目标货架顶部不是同类商品。';
      case 'TARGET_FULL':
        return '目标货架没有空位。';
      case 'SOURCE_TOP_IS_BOX':
        return '箱子需要先打开。';
      case 'TARGET_TOP_IS_BOX':
        return '目标货架顶部是箱子。';
      case 'SOURCE_EMPTY':
        return '来源货架没有可移动商品。';
      case 'SOURCE_SHELF_COMPLETED':
        return '已完成的货架不可操作。';
      case 'SAME_SHELF':
        return '请选择其他目标货架。';
      case 'NO_TOP_CONTENT':
        return '货架顶部没有可用内容。';
      case 'TOP_IS_NOT_BOX':
        return '只有顶部箱子可以打开。';
      default:
        return '当前操作不可用。';
    }
  }

  private publish(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
