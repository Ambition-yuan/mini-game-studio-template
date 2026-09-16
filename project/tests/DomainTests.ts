import {
  getTopGroup,
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

declare const console: {
  log(...values: unknown[]): void;
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
    shelfWith('main-1', 'main', [visible('apple'), visible('apple'), visible('apple')]),
    shelfWith('main-2', 'main', [visible('apple'), null, null])
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

function testMoveRejectsDifferentTop(): void {
  const board = boardWith(
    shelfWith('main-1', 'main', [visible('apple'), visible('apple')]),
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

function testFlowController(): void {
  const controller = new GameFlowController([MVP_LEVELS[0] as LevelConfig]);
  let published: GameSnapshot | null = null;
  const unsubscribe = controller.subscribe((next) => {
    published = next;
  });

  assert(published, 'Flow controller must publish an initial snapshot.');
  let snapshot = controller.getSnapshot();
  assertEqual(snapshot.levelId, 1, 'Expected level 1');
  assertEqual(snapshot.bufferShelfCount, 2, 'Expected two default buffers');
  assertEqual(
    snapshot.board.shelves.filter((shelf) => shelf.kind === 'buffer').length,
    2,
    'Expected two buffer shelves in board'
  );

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

  controller.unlockBufferShelf();
  snapshot = controller.getSnapshot();
  assertEqual(snapshot.bufferShelfCount, 3, 'Expected third buffer shelf');
  controller.restart();
  snapshot = controller.getSnapshot();
  assertEqual(snapshot.bufferShelfCount, 2, 'Restart must reset buffers');
  unsubscribe();
}

const tests: Array<{ readonly name: string; readonly run: () => void }> = [
  { name: 'config validation', run: testConfigValidation },
  { name: 'top group and split move', run: testTopGroupAndSplitMove },
  { name: 'different top restriction', run: testMoveRejectsDifferentTop },
  { name: 'box rules', run: testBoxRules },
  { name: 'win condition', run: testWinCondition },
  { name: 'generated levels', run: testGeneratedLevels },
  { name: 'flow controller', run: testFlowController }
];

let passed = 0;
for (const test of tests) {
  try {
    test.run();
    passed += 1;
    console.log(`PASS ${test.name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`FAIL ${test.name}: ${message}`);
  }
}

console.log(`Domain tests passed: ${passed}/${tests.length}.`);
