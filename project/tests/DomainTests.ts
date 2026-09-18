import {
  getTopIndex,
  getTopGroup,
  isCompletedMainShelf,
  isWon,
  moveTopGroup,
  openTopBox,
  validateBoard
} from '../assets/scripts/game/domain/BoardRules';
import {
  BoardState,
  createShelf,
  ShelfState,
  Slot,
  SlotContent
} from '../assets/scripts/game/domain/BoardTypes';
import {
  LevelConfig,
  MVP_LEVELS,
  validateLevelConfig
} from '../assets/scripts/game/domain/LevelConfig';
import {
  countHiddenItems,
  countItems,
  generateLevel,
  verifyGeneratedLevel
} from '../assets/scripts/game/domain/LevelGenerator';
import {
  GameFlowController,
  GameSnapshot
} from '../assets/scripts/game/flow/GameFlowController';
import {
  createDefaultSaveData,
  decodeSaveData,
  encodeSaveData,
  SaveDataV1
} from '../assets/scripts/services/save/SaveData';
import { MockRewardAdPort } from '../assets/scripts/services/ads/MockRewardAdPort';
import {
  RewardAdPort,
  RewardAdResult
} from '../assets/scripts/services/ads/RewardAdPort';
import {
  KeyValueStorage,
  LocalStorageSavePort
} from '../assets/scripts/services/save/LocalStorageSavePort';
import { MemorySavePort } from '../assets/scripts/services/save/SavePort';

declare const console: {
  log(...values: unknown[]): void;
};

declare const process: {
  exitCode?: number;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}.`);
  }
}

function visible(itemTypeId: string): SlotContent {
  return { itemTypeId, hidden: false };
}

function hidden(itemTypeId: string): SlotContent {
  return { itemTypeId, hidden: true };
}

function boardWith(...shelves: ShelfState[]): BoardState {
  return {
    levelId: 'test',
    shelves
  };
}

function shelfWith(
  id: string,
  kind: 'main' | 'buffer',
  slots: readonly Slot[]
): ShelfState {
  return {
    id,
    kind,
    capacity: slots.length,
    slots: slots.map((slot) => (slot ? { ...slot } : null))
  };
}

function boardSignature(board: BoardState): string {
  return board.shelves
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

function findLegalMove(
  board: BoardState
): { readonly fromShelfId: string; readonly toShelfId: string } | null {
  for (const source of board.shelves) {
    for (const target of board.shelves) {
      if (source.id === target.id) {
        continue;
      }
      if (moveTopGroup(board, source.id, target.id).ok) {
        return {
          fromShelfId: source.id,
          toShelfId: target.id
        };
      }
    }
  }
  return null;
}

function performLegalMove(controller: GameFlowController): void {
  const snapshot = controller.getSnapshot();
  const move = findLegalMove(snapshot.board);
  assert(move, 'Expected at least one legal move.');
  controller.tapShelf(move.fromShelfId);
  controller.tapShelf(move.toShelfId);
}

function mainBoardSignature(board: BoardState): string {
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

function findGeneratedLevelForBoard(
  config: LevelConfig,
  board: BoardState
) {
  const baseSeed = config.generationSeed ?? config.id * 7919;
  const expected = mainBoardSignature(board);

  for (let offset = 0; offset <= 100; offset += 1) {
    const generated = generateLevel(config, baseSeed + offset);
    if (mainBoardSignature(generated.board) === expected) {
      return generated;
    }
  }

  throw new Error(`Could not match generated level ${config.id} to the board.`);
}

function openTopBoxesThroughController(
  controller: GameFlowController,
  shelfId: string
): void {
  for (let guard = 0; guard < 100; guard += 1) {
    const snapshot = controller.getSnapshot();
    const shelf = snapshot.board.shelves.find(
      (candidate) => candidate.id === shelfId
    );
    assert(shelf, `Shelf ${shelfId} must exist.`);

    const topIndex = getTopIndex(shelf);
    const top = topIndex >= 0 ? shelf.slots[topIndex] : null;
    if (!top?.hidden) {
      return;
    }

    const before = boardSignature(snapshot.board);
    controller.tapShelf(shelfId);
    assert(
      boardSignature(controller.getSnapshot().board) !== before,
      `Top box on ${shelfId} should open.`
    );
  }

  throw new Error(`Shelf ${shelfId} still has an unopened top box.`);
}

function solveCurrentLevel(
  controller: GameFlowController,
  config: LevelConfig
): void {
  const generated = findGeneratedLevelForBoard(
    config,
    controller.getSnapshot().board
  );
  assert(generated.solution.length > 0, 'Generated solution must not be empty.');

  for (const move of generated.solution) {
    openTopBoxesThroughController(controller, move.fromShelfId);
    openTopBoxesThroughController(controller, move.toShelfId);

    controller.tapShelf(move.fromShelfId);
    assertEqual(
      controller.getSnapshot().selectedShelfId,
      move.fromShelfId,
      `Solution source ${move.fromShelfId} should select.`
    );
    controller.tapShelf(move.toShelfId);
    const afterMove = controller.getSnapshot();
    if (afterMove.selectedShelfId !== null) {
      throw new Error(
        `Solution move ${move.fromShelfId} -> ${move.toShelfId} ` +
        `expected ${move.expectedItemTypeId} x${move.expectedCount}, ` +
        `but controller reported "${afterMove.message}".`
      );
    }
  }

  const snapshot = controller.getSnapshot();
  assertEqual(
    snapshot.flowState,
    'levelComplete',
    `Level ${config.id} should complete after replaying its solution.`
  );
  assert(snapshot.isWon, `Level ${config.id} must report a win.`);
}

function testConfigValidation(): void {
  const valid = MVP_LEVELS[0];
  assert(valid, 'MVP level 1 must exist.');
  assertEqual(
    validateLevelConfig(valid).length,
    0,
    'MVP level 1 should be valid'
  );

  const invalid: LevelConfig = {
    ...valid,
    boxCount: 1
  };
  assert(
    validateLevelConfig(invalid).some((error) => error.includes('first four')),
    'Tutorial levels must reject boxes'
  );
}

function testTopGroupAndSplitMove(): void {
  const board = boardWith(
    shelfWith(
      'main-1',
      'main',
      [visible('apple'), visible('apple'), visible('apple'), null]
    ),
    shelfWith('main-2', 'main', [visible('apple'), null, null, null])
  );

  const group = getTopGroup(board, 'main-1');
  assert(group, 'Expected a top group.');
  assertEqual(group.count, 3, 'Expected three grouped items');

  const moved = moveTopGroup(board, 'main-1', 'main-2');
  assert(moved.ok, 'Split move should succeed.');

  const source = moved.board.shelves.find((shelf) => shelf.id === 'main-1');
  const target = moved.board.shelves.find((shelf) => shelf.id === 'main-2');
  assert(source && target, 'Both shelves should exist.');
  assertEqual(source.slots[2], null, 'Source top slot should be empty');
  assertEqual(target.slots[0]?.itemTypeId, 'apple', 'Target bottom expected');
  assertEqual(target.slots[1]?.itemTypeId, 'apple', 'Target middle expected');
  assertEqual(target.slots[2]?.itemTypeId, 'apple', 'Target top expected');
}

function testCompletedShelfIsLocked(): void {
  const completed = shelfWith(
    'main-1',
    'main',
    [visible('apple'), visible('apple')]
  );
  const partial = shelfWith(
    'main-2',
    'main',
    [visible('apple'), null]
  );
  const board = boardWith(completed, partial);

  assert(isCompletedMainShelf(completed), 'Full homogeneous shelf is complete.');
  assert(
    !isCompletedMainShelf(partial),
    'Partially filled homogeneous shelf is not complete.'
  );

  const blocked = moveTopGroup(board, 'main-1', 'main-2');
  assert(!blocked.ok, 'Completed main shelf must not be movable.');
  assertEqual(
    blocked.reason,
    'SOURCE_SHELF_COMPLETED',
    'Expected completed shelf failure.'
  );

  const movable = moveTopGroup(board, 'main-2', 'main-1');
  assert(!movable.ok, 'Full target must still reject incoming items.');
}

function testMoveRejectsDifferentTop(): void {
  const board = boardWith(
    shelfWith('main-1', 'main', [visible('apple'), null]),
    shelfWith('main-2', 'main', [visible('milk'), null])
  );

  const moved = moveTopGroup(board, 'main-1', 'main-2');
  assert(!moved.ok, 'Different top item must reject move.');
  assertEqual(
    moved.reason,
    'TARGET_TOP_TYPE_MISMATCH',
    'Expected mismatch failure'
  );
}

function testBoxRules(): void {
  const closed = boardWith(
    shelfWith('main-1', 'main', [hidden('apple')]),
    shelfWith('main-2', 'main', [hidden('apple'), visible('milk')]),
    shelfWith('main-3', 'main', [hidden('apple')]),
    shelfWith('main-4', 'main', [null])
  );

  const opened = openTopBox(closed, 'main-1');
  assert(opened.ok, 'Top box should open.');

  const blocked = openTopBox(closed, 'main-2');
  assert(!blocked.ok, 'Covered box must not open.');
  assertEqual(blocked.reason, 'TOP_IS_NOT_BOX', 'Expected top item to block');

  const moveBox = moveTopGroup(closed, 'main-3', 'main-4');
  assert(!moveBox.ok, 'Box must not move as a group.');
  assertEqual(moveBox.reason, 'SOURCE_TOP_IS_BOX', 'Visible item is on top');
}

function testWinCondition(): void {
  const notWon = boardWith(
    shelfWith('main-1', 'main', [visible('apple'), visible('milk')]),
    shelfWith('buffer-1', 'buffer', [null])
  );
  assert(!isWon(notWon), 'Mixed main shelf must not win.');

  const bufferOccupied = boardWith(
    shelfWith('main-1', 'main', [visible('apple'), null]),
    shelfWith('buffer-1', 'buffer', [visible('milk'), null])
  );
  assert(!isWon(bufferOccupied), 'Non-empty buffer must not win.');

  const won = boardWith(
    shelfWith('main-1', 'main', [visible('apple'), visible('apple')]),
    shelfWith('main-2', 'main', [null, null]),
    shelfWith('buffer-1', 'buffer', [null, null])
  );
  assert(isWon(won), 'Homogeneous main shelves and empty buffers must win.');

  const noEmptyMainShelf = boardWith(
    shelfWith('main-1', 'main', [visible('apple'), visible('apple')]),
    shelfWith('main-2', 'main', [visible('milk'), null]),
    shelfWith('buffer-1', 'buffer', [null, null])
  );
  assert(
    !isWon(noEmptyMainShelf),
    'A board without a fully empty main shelf must not win.'
  );
}

function assertItemCounts(
  config: LevelConfig,
  board: BoardState
): void {
  const actual = countItems(board);
  for (const expected of config.itemCounts) {
    assertEqual(
      actual.get(expected.itemTypeId) ?? 0,
      expected.count,
      `Unexpected count for ${expected.itemTypeId}`
    );
  }
}

function testGeneratedLevels(): void {
  let generatedCount = 0;

  for (const config of MVP_LEVELS) {
    for (let seed = 1; seed <= 100; seed += 1) {
      const generated = generateLevel(config, seed);
      const validationErrors = validateBoard(generated.board);
      assertEqual(
        validationErrors.length,
        0,
        `Generated level ${config.id} seed ${seed} has invalid board`
      );
      assertItemCounts(config, generated.board);
      assertEqual(
        countHiddenItems(generated.board),
        config.boxCount,
        `Generated level ${config.id} seed ${seed} has wrong box count`
      );

      const verification = verifyGeneratedLevel(generated);
      assert(
        verification.ok,
        `Generated level ${config.id} seed ${seed} failed verification: ${verification.reason ?? 'unknown'}`
      );

      generatedCount += 1;
    }
  }

  assert(generatedCount === MVP_LEVELS.length * 100, 'Unexpected generation count.');
}

async function testFlowController(): Promise<void> {
  const controller = new GameFlowController([MVP_LEVELS[0] as LevelConfig]);
  let published: GameSnapshot | null = null;
  const unsubscribe = controller.subscribe((next) => {
    published = next;
  });

  assert(published, 'Flow controller must publish an initial snapshot.');
  let snapshot = controller.getSnapshot();
  assertEqual(snapshot.levelId, 1, 'Expected level 1');
  assertEqual(snapshot.flowState, 'home', 'Flow controller must start at home');
  assertEqual(snapshot.isSettingsOpen, false, 'Settings must start closed');
  assertEqual(snapshot.bufferShelfCount, 2, 'Expected two default buffers');
  assertEqual(
    snapshot.board.shelves.filter((shelf) => shelf.kind === 'buffer').length,
    2,
    'Expected two buffer shelves in board'
  );
  assert(
    snapshot.board.shelves
      .filter((shelf) => shelf.kind === 'buffer')
      .every((shelf) => shelf.capacity === 1),
    'Default buffer shelves must have capacity 1'
  );

  controller.startCurrentLevel();
  snapshot = controller.getSnapshot();
  assertEqual(snapshot.flowState, 'playing', 'Start must enter playing state');

  const firstShelf = snapshot.board.shelves.find(
    (shelf) => shelf.kind === 'main'
  );
  assert(firstShelf, 'Expected a main shelf.');
  controller.tapShelf(firstShelf.id);
  snapshot = controller.getSnapshot();
  assertEqual(
    snapshot.selectedShelfId,
    firstShelf.id,
    'Expected shelf selection'
  );
  controller.tapShelf(firstShelf.id);
  snapshot = controller.getSnapshot();
  assertEqual(snapshot.selectedShelfId, null, 'Expected selection to clear');

  await controller.unlockBufferShelf();
  snapshot = controller.getSnapshot();
  assertEqual(snapshot.bufferShelfCount, 3, 'Expected third buffer shelf');
  assertEqual(
    snapshot.board.shelves.find((shelf) => shelf.id === 'buffer-3')?.capacity,
    1,
    'Unlocked buffer shelf must have capacity 1'
  );
  controller.restart();
  snapshot = controller.getSnapshot();
  assertEqual(snapshot.bufferShelfCount, 2, 'Restart must reset buffers');
  unsubscribe();
}

async function testMockRewardAdPort(): Promise<void> {
  const port = new MockRewardAdPort();
  assert(
    await port.isAvailable('UNLOCK_BUFFER'),
    'Mock reward ad should be available by default.'
  );
  assertEqual(
    await port.show('UNLOCK_BUFFER'),
    'completed',
    'Mock reward ad should complete by default.'
  );

  port.setResult('skipped');
  assertEqual(
    await port.show('UNDO'),
    'skipped',
    'Mock reward ad should expose skipped result.'
  );
  port.setResult('failed');
  assertEqual(
    await port.show('SHUFFLE'),
    'failed',
    'Mock reward ad should expose failed result.'
  );

  port.setAvailable(false);
  assert(
    !(await port.isAvailable('UNDO')),
    'Mock reward ad should expose unavailable state.'
  );
  assertEqual(
    await port.show('UNDO'),
    'unavailable',
    'Unavailable mock reward ad must not complete.'
  );
}

async function testRewardAdLocksInput(): Promise<void> {
  class DeferredRewardAdPort implements RewardAdPort {
    availabilityChecks = 0;
    showCount = 0;
    private resolveShow: ((result: RewardAdResult) => void) | null = null;

    async isAvailable(): Promise<boolean> {
      this.availabilityChecks += 1;
      return true;
    }

    async show(): Promise<RewardAdResult> {
      this.showCount += 1;
      return new Promise((resolve) => {
        this.resolveShow = resolve;
      });
    }

    complete(): void {
      this.resolveShow?.('completed');
    }
  }

  const level: LevelConfig = {
    id: 1,
    shelfCount: 3,
    capacity: 2,
    itemCounts: [
      { itemTypeId: 'apple', count: 2 },
      { itemTypeId: 'milk', count: 2 }
    ],
    boxCount: 0,
    generationSeed: 0
  };
  const port = new DeferredRewardAdPort();
  const controller = new GameFlowController([level], null, port);
  controller.startCurrentLevel();

  const pendingReward = controller.unlockBufferShelf();
  assert(
    controller.getSnapshot().isRewardAdBusy,
    'Pending reward must mark input as busy.'
  );
  controller.tapShelf('main-1');
  assertEqual(
    controller.getSnapshot().selectedShelfId,
    null,
    'Pending reward must block board input.'
  );
  await controller.unlockBufferShelf();
  await Promise.resolve();
  await Promise.resolve();
  assertEqual(port.availabilityChecks, 1, 'Only one ad check may start.');
  assertEqual(port.showCount, 1, 'Only one ad may be shown.');

  port.complete();
  await pendingReward;
  assertEqual(
    controller.getSnapshot().bufferShelfCount,
    3,
    'Completed pending reward must grant once.'
  );
  assertEqual(
    controller.getSnapshot().isRewardAdBusy,
    false,
    'Completed reward must clear busy state.'
  );
}

async function testRewardAdBusinessRules(): Promise<void> {
  const level: LevelConfig = {
    id: 1,
    shelfCount: 3,
    capacity: 2,
    itemCounts: [
      { itemTypeId: 'apple', count: 2 },
      { itemTypeId: 'milk', count: 2 }
    ],
    boxCount: 0,
    generationSeed: 0
  };
  const createController = (port: MockRewardAdPort): GameFlowController => {
    const controller = new GameFlowController([level], null, port);
    controller.startCurrentLevel();
    return controller;
  };

  const unlockPort = new MockRewardAdPort();
  const unlockController = createController(unlockPort);
  await unlockController.unlockBufferShelf();
  assertEqual(
    unlockController.getSnapshot().bufferShelfCount,
    3,
    'Completed unlock reward must add a buffer shelf.'
  );
  assertEqual(
    unlockController.getSnapshot().board.shelves
      .find((shelf) => shelf.id === 'buffer-3')?.capacity,
    1,
    'Reward-unlocked buffer shelf must have capacity 1.'
  );
  assertEqual(
    JSON.stringify(unlockPort.getShownReasons()),
    JSON.stringify(['UNLOCK_BUFFER']),
    'Unlock must use the unlock reward reason.'
  );

  const maxPort = new MockRewardAdPort();
  const maxController = createController(maxPort);
  for (let index = 0; index < 6; index += 1) {
    await maxController.unlockBufferShelf();
  }
  assertEqual(
    maxController.getSnapshot().bufferShelfCount,
    8,
    'Reward unlocks must stop at eight buffer shelves.'
  );
  await maxController.unlockBufferShelf();
  assertEqual(
    maxController.getSnapshot().bufferShelfCount,
    8,
    'Maximum buffer count must not add another shelf.'
  );
  assertEqual(
    maxPort.getShownReasons().length,
    6,
    'Maximum buffer count must not request another ad.'
  );

  const undoPort = new MockRewardAdPort();
  const undoController = createController(undoPort);
  const undoBoardBefore = boardSignature(undoController.getSnapshot().board);
  performLegalMove(undoController);
  assert(undoController.getSnapshot().canUndo, 'Legal move must create undo.');
  await undoController.undo();
  assertEqual(
    boardSignature(undoController.getSnapshot().board),
    undoBoardBefore,
    'Completed undo reward must restore the previous board.'
  );
  assertEqual(
    undoController.getSnapshot().canUndo,
    false,
    'Completed undo reward must consume one history entry.'
  );
  assertEqual(
    JSON.stringify(undoPort.getShownReasons()),
    JSON.stringify(['UNDO']),
    'Undo must use the undo reward reason.'
  );

  const shufflePort = new MockRewardAdPort();
  const shuffleController = createController(shufflePort);
  await shuffleController.unlockBufferShelf();
  const shuffleBoardBefore = boardSignature(
    shuffleController.getSnapshot().board
  );
  await shuffleController.shuffle();
  const shuffledSnapshot = shuffleController.getSnapshot();
  assert(
    boardSignature(shuffledSnapshot.board) !== shuffleBoardBefore,
    'Completed shuffle reward must replace the board.'
  );
  assertEqual(
    shuffledSnapshot.bufferShelfCount,
    3,
    'Shuffle must preserve unlocked buffer count.'
  );
  assert(
    shuffledSnapshot.board.shelves
      .filter((shelf) => shelf.kind === 'buffer')
      .every((shelf) => shelf.slots.every((slot) => slot === null)),
    'Shuffle must clear buffer contents.'
  );
  assertEqual(
    shuffledSnapshot.canUndo,
    false,
    'Shuffle must clear undo history.'
  );
  assertEqual(
    JSON.stringify(shufflePort.getShownReasons()),
    JSON.stringify(['UNLOCK_BUFFER', 'SHUFFLE']),
    'Shuffle must use the shuffle reward reason.'
  );

  const deniedResults: Array<Exclude<RewardAdResult, 'completed'>> = [
    'skipped',
    'unavailable',
    'failed'
  ];
  const deniedMessages: Record<Exclude<RewardAdResult, 'completed'>, string> = {
    skipped: '未完成激励视频，奖励未发放。',
    unavailable: '奖励广告暂不可用。',
    failed: '奖励广告播放失败。'
  };
  for (const result of deniedResults) {
    const deniedResult = result;
    const createDeniedPort = (): MockRewardAdPort => new MockRewardAdPort({
      available: result !== 'unavailable',
      result
    });

    const deniedUnlockController = createController(createDeniedPort());
    const unlockBoardBefore = boardSignature(
      deniedUnlockController.getSnapshot().board
    );
    await deniedUnlockController.unlockBufferShelf();
    assertEqual(
      deniedUnlockController.getSnapshot().bufferShelfCount,
      2,
      `${result} unlock must not add a buffer shelf.`
    );
    assertEqual(
      boardSignature(deniedUnlockController.getSnapshot().board),
      unlockBoardBefore,
      `${result} unlock must not change the board.`
    );
    assertEqual(
      deniedUnlockController.getSnapshot().message,
      deniedMessages[deniedResult],
      `${result} unlock must report the matching reward result.`
    );

    const deniedUndoController = createController(createDeniedPort());
    performLegalMove(deniedUndoController);
    const undoStateAfterMove = boardSignature(
      deniedUndoController.getSnapshot().board
    );
    await deniedUndoController.undo();
    assertEqual(
      boardSignature(deniedUndoController.getSnapshot().board),
      undoStateAfterMove,
      `${result} undo must preserve the current board.`
    );
    assert(
      deniedUndoController.getSnapshot().canUndo,
      `${result} undo must preserve history.`
    );

    const deniedShuffleController = createController(createDeniedPort());
    const shuffleBoardBefore = boardSignature(
      deniedShuffleController.getSnapshot().board
    );
    await deniedShuffleController.shuffle();
    assertEqual(
      boardSignature(deniedShuffleController.getSnapshot().board),
      shuffleBoardBefore,
      `${result} shuffle must preserve the current board.`
    );
  }
}

function testBaseLevelCompletesWithoutAds(): void {
  const level: LevelConfig = {
    id: 1,
    shelfCount: 3,
    capacity: 2,
    itemCounts: [
      { itemTypeId: 'apple', count: 2 },
      { itemTypeId: 'milk', count: 2 }
    ],
    boxCount: 0,
    generationSeed: 0
  };
  const port = new MockRewardAdPort();
  const controller = new GameFlowController([level], null, port);
  controller.startCurrentLevel();
  controller.tapShelf('main-1');
  controller.tapShelf('main-3');
  controller.tapShelf('main-2');
  controller.tapShelf('main-1');
  controller.tapShelf('main-3');
  controller.tapShelf('main-2');

  assertEqual(
    controller.getSnapshot().flowState,
    'levelComplete',
    'Base level must complete without advertisements.'
  );
  assertEqual(
    port.getAvailabilityChecks().length,
    0,
    'Base level completion must not query reward ads.'
  );
  assertEqual(
    port.getShownReasons().length,
    0,
    'Base level completion must not show reward ads.'
  );
}

async function testFullMvpRegression(): Promise<void> {
  const regressionLevels: readonly LevelConfig[] = Array.from(
    { length: 10 },
    (_, index): LevelConfig => ({
      id: index + 1,
      shelfCount: 3,
      capacity: 2,
      itemCounts: [
        { itemTypeId: 'apple', count: 2 },
        { itemTypeId: 'milk', count: 2 }
      ],
      boxCount: 0,
      generationSeed: 0
    })
  );
  const savePort = new MemorySavePort();
  const rewardPort = new MockRewardAdPort();
  const controller = new GameFlowController(
    regressionLevels,
    savePort,
    rewardPort
  );
  controller.restoreSaveData(await savePort.load(regressionLevels.length));

  let snapshot = controller.getSnapshot();
  assertEqual(snapshot.flowState, 'home', 'Regression must start at home.');
  assertEqual(snapshot.levelId, 1, 'Regression must start at level 1.');

  controller.startCurrentLevel();
  snapshot = controller.getSnapshot();
  assertEqual(snapshot.flowState, 'playing', 'Start must enter level 1.');
  const levelOneBeforeMove = boardSignature(snapshot.board);

  performLegalMove(controller);
  assert(controller.getSnapshot().canUndo, 'Move must create undo history.');
  await controller.undo();
  assertEqual(
    boardSignature(controller.getSnapshot().board),
    levelOneBeforeMove,
    'Rewarded undo must restore level 1.'
  );

  controller.openSettings();
  controller.toggleSound();
  assertEqual(
    controller.getSnapshot().soundEnabled,
    false,
    'Settings toggle must update sound state.'
  );
  controller.goHome();
  snapshot = controller.getSnapshot();
  assertEqual(snapshot.flowState, 'home', 'Settings must be able to return home.');
  assertEqual(snapshot.isSettingsOpen, false, 'Returning home must close settings.');

  controller.startCurrentLevel();
  snapshot = controller.getSnapshot();
  assertEqual(snapshot.flowState, 'playing', 'Home restart must enter playing.');

  await controller.unlockBufferShelf();
  assertEqual(
    controller.getSnapshot().bufferShelfCount,
    3,
    'Mock unlock must add a third buffer shelf.'
  );

  const beforeShuffle = boardSignature(controller.getSnapshot().board);
  await controller.shuffle();
  assert(
    boardSignature(controller.getSnapshot().board) !== beforeShuffle,
    'Mock shuffle must replace the board.'
  );
  assertEqual(
    controller.getSnapshot().bufferShelfCount,
    3,
    'Shuffle must preserve unlocked buffers.'
  );

  controller.restart();
  snapshot = controller.getSnapshot();
  assertEqual(
    snapshot.bufferShelfCount,
    2,
    'Restart must reset buffers to the default two.'
  );
  assertEqual(snapshot.flowState, 'playing', 'Restart must stay in playing.');

  for (let index = 0; index < regressionLevels.length; index += 1) {
    const config = regressionLevels[index] as LevelConfig;
    snapshot = controller.getSnapshot();
    assertEqual(
      snapshot.levelId,
      config.id,
      `Regression should enter level ${config.id}.`
    );
    assertEqual(
      snapshot.flowState,
      'playing',
      `Level ${config.id} must be playable.`
    );

    solveCurrentLevel(controller, config);
    snapshot = controller.getSnapshot();
    assertEqual(
      snapshot.flowState,
      'levelComplete',
      `Level ${config.id} must enter levelComplete.`
    );

    const saved = await savePort.load(regressionLevels.length);
    assert(
      saved.data.completedLevels.includes(config.id),
      `Level ${config.id} completion must be saved.`
    );

    if (index < regressionLevels.length - 1) {
      controller.nextLevel();
      assertEqual(
        controller.getSnapshot().levelId,
        config.id + 1,
        `Next level after ${config.id} must be ${config.id + 1}.`
      );
    }
  }

  snapshot = controller.getSnapshot();
  assertEqual(
    snapshot.flowState,
    'levelComplete',
    'Level 10 must remain complete before the boundary action.'
  );
  const levelTenCompletedBoard = boardSignature(snapshot.board);
  controller.nextLevel();
  snapshot = controller.getSnapshot();
  assertEqual(
    snapshot.flowState,
    'levelComplete',
    'Level 10 boundary must remain complete.'
  );
  assertEqual(
    boardSignature(snapshot.board),
    levelTenCompletedBoard,
    'Level 10 boundary must not regenerate the board.'
  );
  assert(
    snapshot.message.includes('全部关卡'),
    'Level 10 boundary must report all levels complete.'
  );

  controller.goHome();
  snapshot = controller.getSnapshot();
  assertEqual(snapshot.flowState, 'home', 'Final regression must return home.');
  controller.startCurrentLevel();
  snapshot = controller.getSnapshot();
  assertEqual(snapshot.levelId, 10, 'Final selection must remain level 10.');
  assertEqual(snapshot.flowState, 'playing', 'Level 10 must remain replayable.');
  assertEqual(
    snapshot.soundEnabled,
    false,
    'Saved audio setting must survive full regression.'
  );
  assertEqual(
    JSON.stringify(rewardPort.getShownReasons()),
    JSON.stringify(['UNDO', 'UNLOCK_BUFFER', 'SHUFFLE']),
    'Only requested reward actions may show advertisements.'
  );
}

function testFlowLevelProgression(): void {
  const firstLevel: LevelConfig = {
    id: 1,
    shelfCount: 3,
    capacity: 2,
    itemCounts: [
      { itemTypeId: 'apple', count: 2 },
      { itemTypeId: 'milk', count: 2 }
    ],
    boxCount: 0,
    generationSeed: 0
  };
  const secondLevel: LevelConfig = {
    ...firstLevel,
    id: 2,
    generationSeed: 0
  };

  const controller = new GameFlowController([firstLevel, secondLevel]);
  let snapshot = controller.getSnapshot();
  assertEqual(snapshot.flowState, 'home', 'Expected home state');
  assertEqual(snapshot.isLastLevel, false, 'First level must have a next level');

  controller.startCurrentLevel();
  snapshot = controller.getSnapshot();
  assertEqual(snapshot.flowState, 'playing', 'Expected playing state');

  controller.tapShelf('main-1');
  controller.tapShelf('main-3');
  controller.tapShelf('main-2');
  controller.tapShelf('main-1');
  controller.tapShelf('main-3');
  controller.tapShelf('main-2');
  snapshot = controller.getSnapshot();
  assertEqual(snapshot.flowState, 'levelComplete', 'Winning must complete level');
  assert(snapshot.isWon, 'Completed level must report a win');

  controller.nextLevel();
  snapshot = controller.getSnapshot();
  assertEqual(snapshot.levelId, 2, 'Expected next level');
  assertEqual(snapshot.flowState, 'playing', 'Next level must return to playing');
  assertEqual(snapshot.isLastLevel, true, 'Second level must be last');
  assertEqual(snapshot.bufferShelfCount, 2, 'Next level must reset buffers');
  assertEqual(snapshot.selectedShelfId, null, 'Next level must clear selection');
  assertEqual(snapshot.canUndo, false, 'Next level must clear history');

  controller.goHome();
  snapshot = controller.getSnapshot();
  assertEqual(snapshot.flowState, 'home', 'Expected home state');
  controller.tapShelf('main-1');
  snapshot = controller.getSnapshot();
  assertEqual(
    snapshot.selectedShelfId,
    null,
    'Home state must reject board interaction'
  );

  controller.startCurrentLevel();
  snapshot = controller.getSnapshot();
  assertEqual(snapshot.levelId, 2, 'Start must keep the selected level');
  assertEqual(snapshot.flowState, 'playing', 'Start must resume playing state');
}

function testLastLevelBoundary(): void {
  const onlyLevel: LevelConfig = {
    id: 1,
    shelfCount: 3,
    capacity: 2,
    itemCounts: [
      { itemTypeId: 'apple', count: 2 },
      { itemTypeId: 'milk', count: 2 }
    ],
    boxCount: 0,
    generationSeed: 0
  };
  const controller = new GameFlowController([onlyLevel]);

  controller.startCurrentLevel();
  controller.tapShelf('main-1');
  controller.tapShelf('main-3');
  controller.tapShelf('main-2');
  controller.tapShelf('main-1');
  controller.tapShelf('main-3');
  controller.tapShelf('main-2');
  assertEqual(
    controller.getSnapshot().flowState,
    'levelComplete',
    'Single level should complete'
  );

  const completedBoard = controller.getSnapshot().board;
  controller.nextLevel();
  const snapshot = controller.getSnapshot();
  assertEqual(snapshot.levelId, 1, 'Last level must remain selected');
  assertEqual(
    snapshot.flowState,
    'levelComplete',
    'Last level boundary must remain complete'
  );
  assertEqual(
    boardSignature(snapshot.board),
    boardSignature(completedBoard),
    'Last level boundary must not regenerate the board'
  );
  assert(
    snapshot.message.includes('全部关卡'),
    'Last level boundary should report all levels complete'
  );
}

function testHomeSettingsFlow(): void {
  const config: LevelConfig = {
    id: 1,
    shelfCount: 4,
    capacity: 2,
    itemCounts: [
      { itemTypeId: 'apple', count: 2 },
      { itemTypeId: 'milk', count: 2 },
      { itemTypeId: 'cookie', count: 2 }
    ],
    boxCount: 0,
    generationSeed: 0
  };
  const controller = new GameFlowController([config]);

  let snapshot = controller.getSnapshot();
  assertEqual(snapshot.flowState, 'home', 'Expected initial home state');
  const initialBoard = boardSignature(snapshot.board);

  controller.openSettings();
  snapshot = controller.getSnapshot();
  assertEqual(
    snapshot.isSettingsOpen,
    false,
    'Home must reject opening in-game settings'
  );

  controller.startCurrentLevel();
  snapshot = controller.getSnapshot();
  const firstSessionBoard = boardSignature(snapshot.board);
  assertEqual(snapshot.flowState, 'playing', 'Start must enter playing state');
  assert(
    firstSessionBoard !== initialBoard,
    'Start must regenerate the current level'
  );

  controller.openSettings();
  snapshot = controller.getSnapshot();
  assertEqual(snapshot.isSettingsOpen, true, 'Settings must open in game');
  controller.tapShelf('main-1');
  snapshot = controller.getSnapshot();
  assertEqual(
    snapshot.selectedShelfId,
    null,
    'Settings must block board interaction'
  );

  controller.closeSettings();
  snapshot = controller.getSnapshot();
  assertEqual(snapshot.isSettingsOpen, false, 'Settings must close');
  assertEqual(snapshot.flowState, 'playing', 'Close must return to playing');

  controller.goHome();
  snapshot = controller.getSnapshot();
  assertEqual(snapshot.flowState, 'home', 'Expected home after leaving game');
  assertEqual(snapshot.isSettingsOpen, false, 'Home must close settings');

  controller.startCurrentLevel();
  snapshot = controller.getSnapshot();
  assert(
    boardSignature(snapshot.board) !== firstSessionBoard,
    'Restarting from home must regenerate the unfinished level'
  );

  const secondSessionBoard = boardSignature(snapshot.board);
  controller.restart();
  snapshot = controller.getSnapshot();
  assertEqual(snapshot.flowState, 'playing', 'Restart must remain playing');
  assert(
    boardSignature(snapshot.board) !== secondSessionBoard,
    'Restart must regenerate the current level'
  );
}

function testSaveDataCodec(): void {
  const defaults = createDefaultSaveData(10);
  assertEqual(defaults.selectedLevel, 1, 'Default selected level must be 1');
  assertEqual(defaults.highestUnlockedLevel, 1, 'Default unlock must be 1');
  assertEqual(defaults.soundEnabled, true, 'Sound should default on');
  assertEqual(defaults.musicEnabled, true, 'Music should default on');

  const missing = decodeSaveData(null, 10);
  assertEqual(missing.status, 'missing', 'Missing save should be reported');
  assertEqual(missing.canWrite, true, 'Missing save should be writable');

  const valid = decodeSaveData(
    JSON.stringify({
      schemaVersion: 1,
      highestUnlockedLevel: 5,
      selectedLevel: 3,
      completedLevels: [3, 1, 3, 99],
      soundEnabled: false,
      musicEnabled: true
    }),
    10
  );
  assertEqual(valid.status, 'loaded', 'Valid save should load');
  assertEqual(valid.canWrite, true, 'Valid save should be writable');
  assertEqual(valid.data.selectedLevel, 3, 'Expected selected level 3');
  assertEqual(
    JSON.stringify(valid.data.completedLevels),
    JSON.stringify([1, 3]),
    'Completed levels should be unique and sorted'
  );
  assertEqual(valid.data.soundEnabled, false, 'Sound preference should load');

  const clamped = decodeSaveData(
    JSON.stringify({
      schemaVersion: 1,
      highestUnlockedLevel: 2,
      selectedLevel: 9,
      completedLevels: [],
      soundEnabled: true,
      musicEnabled: true
    }),
    10
  );
  assertEqual(clamped.data.selectedLevel, 2, 'Selected level must be clamped');

  const invalid = decodeSaveData('{bad json', 10);
  assertEqual(invalid.status, 'invalid', 'Invalid save should be reported');
  assertEqual(invalid.canWrite, false, 'Invalid save must not be overwritten');

  const unsupported = decodeSaveData(
    JSON.stringify({ schemaVersion: 99 }),
    10
  );
  assertEqual(
    unsupported.status,
    'unsupported',
    'Unsupported save version should be reported'
  );
  assertEqual(
    unsupported.canWrite,
    false,
    'Unsupported save must not be overwritten'
  );
}

async function testMemorySavePort(): Promise<void> {
  const port = new MemorySavePort();
  const initial = await port.load(10);
  assertEqual(initial.status, 'missing', 'Memory store should start empty');

  const data: SaveDataV1 = {
    schemaVersion: 1,
    highestUnlockedLevel: 4,
    selectedLevel: 2,
    completedLevels: [1, 2],
    soundEnabled: false,
    musicEnabled: true
  };
  await port.save(data);

  const loaded = await port.load(10);
  assertEqual(loaded.status, 'loaded', 'Memory store should reload data');
  assertEqual(loaded.data.highestUnlockedLevel, 4, 'Expected unlock level 4');
  assertEqual(loaded.data.selectedLevel, 2, 'Expected selected level 2');
  assertEqual(
    port.getRaw(),
    encodeSaveData(data),
    'Memory store raw data should be encoded save data'
  );
}

async function testLocalStorageSavePort(): Promise<void> {
  class TestStorage implements KeyValueStorage {
    private readonly values = new Map<string, string>();

    getItem(key: string): string | null {
      return this.values.get(key) ?? null;
    }

    setItem(key: string, value: string): void {
      this.values.set(key, value);
    }
  }

  const storage = new TestStorage();
  const port = new LocalStorageSavePort(storage, 'test-save');
  assertEqual(
    (await port.load(10)).status,
    'missing',
    'Storage adapter should start empty'
  );

  const data: SaveDataV1 = {
    schemaVersion: 1,
    highestUnlockedLevel: 3,
    selectedLevel: 3,
    completedLevels: [1, 2],
    soundEnabled: true,
    musicEnabled: false
  };
  await port.save(data);

  const loaded = await port.load(10);
  assertEqual(loaded.status, 'loaded', 'Storage adapter should reload data');
  assertEqual(loaded.data.selectedLevel, 3, 'Expected stored selected level');
  assertEqual(
    storage.getItem('test-save'),
    encodeSaveData(data),
    'Storage adapter should write encoded data'
  );
}

async function testSaveControllerIntegration(): Promise<void> {
  const firstLevel: LevelConfig = {
    id: 1,
    shelfCount: 3,
    capacity: 2,
    itemCounts: [
      { itemTypeId: 'apple', count: 2 },
      { itemTypeId: 'milk', count: 2 }
    ],
    boxCount: 0,
    generationSeed: 0
  };
  const secondLevel: LevelConfig = {
    ...firstLevel,
    id: 2
  };
  const restoredSave: SaveDataV1 = {
    schemaVersion: 1,
    highestUnlockedLevel: 2,
    selectedLevel: 2,
    completedLevels: [1],
    soundEnabled: false,
    musicEnabled: true
  };
  const port = new MemorySavePort(encodeSaveData(restoredSave));
  const controller = new GameFlowController(
    [firstLevel, secondLevel],
    port
  );
  controller.restoreSaveData(await port.load(2));

  let snapshot = controller.getSnapshot();
  assertEqual(snapshot.flowState, 'home', 'Restored game must start at home');
  assertEqual(snapshot.levelId, 2, 'Restored selected level must be level 2');
  assertEqual(snapshot.soundEnabled, false, 'Restored sound must be off');

  controller.startCurrentLevel();
  snapshot = controller.getSnapshot();
  assertEqual(snapshot.flowState, 'playing', 'Start must enter playing state');
  assertEqual(snapshot.levelId, 2, 'Start must use restored selected level');

  controller.openSettings();
  controller.toggleSound();
  controller.toggleMusic();
  const settingsSave = await port.load(2);
  assertEqual(settingsSave.data.soundEnabled, true, 'Sound toggle must save');
  assertEqual(settingsSave.data.musicEnabled, false, 'Music toggle must save');

  const winPort = new MemorySavePort();
  const winController = new GameFlowController([firstLevel], winPort);
  winController.restoreSaveData(await winPort.load(1));
  winController.startCurrentLevel();
  winController.tapShelf('main-1');
  winController.tapShelf('main-3');
  winController.tapShelf('main-2');
  winController.tapShelf('main-1');
  winController.tapShelf('main-3');
  winController.tapShelf('main-2');

  const completedSave = await winPort.load(1);
  assertEqual(
    JSON.stringify(completedSave.data.completedLevels),
    JSON.stringify([1]),
    'Completing a level must save completion'
  );
  assertEqual(
    completedSave.data.highestUnlockedLevel,
    1,
    'Last level must remain the highest unlocked level'
  );
}

const tests: Array<{
  readonly name: string;
  readonly run: () => void | Promise<void>;
}> = [
  { name: 'config validation', run: testConfigValidation },
  { name: 'top group and split move', run: testTopGroupAndSplitMove },
  { name: 'completed shelf lock', run: testCompletedShelfIsLocked },
  { name: 'different top restriction', run: testMoveRejectsDifferentTop },
  { name: 'box rules', run: testBoxRules },
  { name: 'win condition', run: testWinCondition },
  { name: 'generated levels', run: testGeneratedLevels },
  { name: 'flow controller', run: testFlowController },
  { name: 'mock reward ad port', run: testMockRewardAdPort },
  { name: 'reward ad input lock', run: testRewardAdLocksInput },
  { name: 'reward ad business rules', run: testRewardAdBusinessRules },
  { name: 'base level without ads', run: testBaseLevelCompletesWithoutAds },
  { name: 'full MVP regression', run: testFullMvpRegression },
  { name: 'flow level progression', run: testFlowLevelProgression },
  { name: 'last level boundary', run: testLastLevelBoundary },
  { name: 'home settings flow', run: testHomeSettingsFlow },
  { name: 'save data codec', run: testSaveDataCodec },
  { name: 'memory save port', run: testMemorySavePort },
  { name: 'local storage save port', run: testLocalStorageSavePort },
  { name: 'save controller integration', run: testSaveControllerIntegration }
];

async function runTests(): Promise<void> {
  let passed = 0;
  for (const test of tests) {
    try {
      await test.run();
      passed += 1;
      console.log(`PASS ${test.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`FAIL ${test.name}: ${message}`);
    }
  }

  console.log(`Domain tests passed: ${passed}/${tests.length}.`);
}

void runTests().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.log(message);
  process.exitCode = 1;
});
