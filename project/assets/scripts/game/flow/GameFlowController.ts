import {
  getTopIndex,
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

export interface GameSnapshot {
  readonly levelId: number;
  readonly levelTitle: string;
  readonly board: BoardState;
  readonly selectedShelfId: string | null;
  readonly message: string;
  readonly isWon: boolean;
  readonly bufferShelfCount: number;
  readonly canUndo: boolean;
}

type SnapshotListener = (snapshot: GameSnapshot) => void;

const DEFAULT_BUFFER_COUNT = 2;
const MAX_BUFFER_COUNT = 8;
const MAX_HISTORY = 100;

export class GameFlowController {
  private readonly levels: readonly LevelConfig[];
  private readonly listeners = new Set<SnapshotListener>();
  private readonly history: BoardState[] = [];

  private config: LevelConfig;
  private generated: GeneratedLevel;
  private board: BoardState;
  private selectedShelfId: string | null = null;
  private message = '点击货架顶部连续同类商品，再点击目标货架。';
  private bufferShelfCount = DEFAULT_BUFFER_COUNT;
  private seedOffset = 0;

  constructor(levels: readonly LevelConfig[] = MVP_LEVELS) {
    if (levels.length === 0) {
      throw new Error('At least one level is required.');
    }

    this.levels = levels;
    this.config = levels[0] as LevelConfig;
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
      isWon: isWon(this.board),
      bufferShelfCount: this.bufferShelfCount,
      canUndo: this.history.length > 0
    };
  }

  startLevel(levelId: number): void {
    const config = this.levels.find((level) => level.id === levelId);
    if (!config) {
      return;
    }

    this.config = config;
    this.bufferShelfCount = DEFAULT_BUFFER_COUNT;
    this.generated = generateLevel(config, this.nextSeed());
    this.board = this.createBoardWithBuffers(
      this.generated.board,
      this.bufferShelfCount
    );
    this.history.length = 0;
    this.selectedShelfId = null;
    this.message = '点击货架顶部连续同类商品，再点击目标货架。';
    this.publish();
  }

  restart(): void {
    this.startLevel(this.config.id);
  }

  tapShelf(shelfId: string): void {
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
    this.message = isWon(this.board) ? '整理完成。' : '已移动商品。';
    this.publish();
  }

  undo(): void {
    const previous = this.history.pop();
    if (!previous) {
      this.message = '当前没有可撤回的操作。';
      this.publish();
      return;
    }

    this.board = cloneBoard(previous);
    this.selectedShelfId = null;
    this.message = '已撤回一步。';
    this.publish();
  }

  unlockBufferShelf(): void {
    if (this.bufferShelfCount >= MAX_BUFFER_COUNT) {
      this.message = '缓冲货架已达到上限。';
      this.publish();
      return;
    }

    this.bufferShelfCount += 1;
    const next = cloneBoard(this.board);
    next.shelves.push(
      createShelf(`buffer-${this.bufferShelfCount}`, 'buffer', 2)
    );
    this.board = next;
    this.message = `已解锁第 ${this.bufferShelfCount} 个缓冲货架。`;
    this.publish();
  }

  shuffle(): void {
    this.seedOffset += 1;
    this.generated = generateLevel(
      this.config,
      this.nextSeed()
    );
    this.board = this.createBoardWithBuffers(
      this.generated.board,
      this.bufferShelfCount
    );
    this.history.length = 0;
    this.selectedShelfId = null;
    this.message = '已生成新的可解布局。';
    this.publish();
  }

  private createBoardWithBuffers(
    source: BoardState,
    bufferCount: number
  ): BoardState {
    const next = cloneBoard(source);
    for (let index = 0; index < bufferCount; index += 1) {
      next.shelves.push(
        createShelf(`buffer-${index + 1}`, 'buffer', 2)
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
    this.message = isWon(this.board) ? '整理完成。' : successMessage;
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
