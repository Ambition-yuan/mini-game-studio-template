import {
  getFreeSlotCount,
  getTopGroup,
  getTopIndex,
  isWon,
  moveTopGroup,
  openTopBox
} from './BoardRules';
import {
  BoardState,
  cloneBoard,
  createShelf,
  ShelfState,
  SlotContent
} from './BoardTypes';
import { LevelConfig, validateLevelConfig } from './LevelConfig';

export interface PlannedMove {
  readonly fromShelfId: string;
  readonly toShelfId: string;
  readonly expectedItemTypeId: string;
  readonly expectedCount: number;
}

export interface GeneratedLevel {
  readonly config: LevelConfig;
  readonly seed: number;
  readonly board: BoardState;
  readonly solution: readonly PlannedMove[];
}

export interface VerificationResult {
  readonly ok: boolean;
  readonly reason?: string;
}

function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(
  random: () => number,
  minInclusive: number,
  maxInclusive: number
): number {
  const range = maxInclusive - minInclusive + 1;
  return minInclusive + Math.floor(random() * range);
}

function createSolvedBoard(config: LevelConfig): BoardState {
  const shelves = Array.from({ length: config.shelfCount }, (_, index) =>
    createShelf(`main-${index + 1}`, 'main', config.capacity)
  );

  let shelfIndex = 0;
  let tokenIndex = 0;
  for (const item of config.itemCounts) {
    const shelfUnits = item.count / config.capacity;
    for (let unit = 0; unit < shelfUnits; unit += 1) {
      const shelf = shelves[shelfIndex];
      if (!shelf) {
        throw new Error('Solved board generation exceeded shelf count.');
      }

      for (let slotIndex = 0; slotIndex < shelf.capacity; slotIndex += 1) {
        shelf.slots[slotIndex] = {
          itemTypeId: item.itemTypeId,
          hidden: false,
          tokenId: `${item.itemTypeId}-${tokenIndex}`
        };
        tokenIndex += 1;
      }
      shelfIndex += 1;
    }
  }

  return {
    levelId: String(config.id),
    shelves
  };
}

function applyInverseMove(
  board: BoardState,
  fromShelfId: string,
  toShelfId: string,
  count: number
): boolean {
  const fromShelf = board.shelves.find((shelf) => shelf.id === fromShelfId);
  const toShelf = board.shelves.find((shelf) => shelf.id === toShelfId);
  if (!fromShelf || !toShelf) {
    return false;
  }

  const fromTop = getTopIndex(fromShelf);
  const toTop = getTopIndex(toShelf);
  if (fromTop - count + 1 < 0 || getFreeSlotCount(toShelf) < count) {
    return false;
  }

  for (let offset = 0; offset < count; offset += 1) {
    const fromIndex = fromTop - offset;
    const content = fromShelf.slots[fromIndex];
    if (!content) {
      return false;
    }

    fromShelf.slots[fromIndex] = null;
    toShelf.slots[toTop + 1 + offset] = {
      itemTypeId: content.itemTypeId,
      hidden: false,
      tokenId: content.tokenId
    };
  }

  return true;
}

function findInverseMove(
  board: BoardState,
  random: () => number
): {
  readonly sourceShelfId: string;
  readonly targetShelfId: string;
  readonly count: number;
  readonly itemTypeId: string;
} | null {
  const candidates: Array<{
    readonly sourceShelfId: string;
    readonly targetShelfId: string;
    readonly count: number;
    readonly itemTypeId: string;
  }> = [];

  for (const sourceShelf of board.shelves) {
    const group = getTopGroup(board, sourceShelf.id);
    if (!group) {
      continue;
    }

    const counts: number[] = [];
    if (group.count > 1) {
      for (let count = 1; count < group.count; count += 1) {
        counts.push(count);
      }
    }
    if (group.startIndex === 0) {
      counts.push(group.count);
    }

    for (const count of counts) {
      for (const targetShelf of board.shelves) {
        if (
          targetShelf.id === sourceShelf.id ||
          getFreeSlotCount(targetShelf) < count
        ) {
          continue;
        }

        const targetTopIndex = getTopIndex(targetShelf);
        const targetTop =
          targetTopIndex >= 0 ? targetShelf.slots[targetTopIndex] : null;
        if (targetTop?.itemTypeId === group.itemTypeId) {
          continue;
        }

        candidates.push({
          sourceShelfId: sourceShelf.id,
          targetShelfId: targetShelf.id,
          count,
          itemTypeId: group.itemTypeId
        });
      }
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  return candidates[randomInt(random, 0, candidates.length - 1)] ?? null;
}

function replaceRandomItemsWithBoxes(
  board: BoardState,
  boxCount: number,
  random: () => number,
  eligibleTokenIds: ReadonlySet<string>
): void {
  if (boxCount === 0) {
    return;
  }

  const eligiblePositions: Array<{ shelf: ShelfState; slotIndex: number }> = [];
  const otherPositions: Array<{ shelf: ShelfState; slotIndex: number }> = [];
  for (const shelf of board.shelves) {
    if (shelf.kind !== 'main') {
      continue;
    }
    for (let slotIndex = 0; slotIndex < shelf.capacity; slotIndex += 1) {
      const content = shelf.slots[slotIndex];
      if (!content) {
        continue;
      }

      const position = { shelf, slotIndex };
      if (content.tokenId && eligibleTokenIds.has(content.tokenId)) {
        eligiblePositions.push(position);
      } else {
        otherPositions.push(position);
      }
    }
  }

  const shuffle = (
    positions: Array<{ shelf: ShelfState; slotIndex: number }>
  ): void => {
    for (let index = positions.length - 1; index > 0; index -= 1) {
      const swapIndex = randomInt(random, 0, index);
      const current = positions[index];
      const swap = positions[swapIndex];
      if (!current || !swap) {
        continue;
      }
      positions[index] = swap;
      positions[swapIndex] = current;
    }
  };

  shuffle(eligiblePositions);
  shuffle(otherPositions);

  const selected = [
    ...eligiblePositions.slice(0, boxCount),
    ...otherPositions.slice(0, Math.max(0, boxCount - eligiblePositions.length))
  ];
  if (selected.length < boxCount) {
    throw new Error('Not enough item positions available for box placement.');
  }

  for (const position of selected) {
    const content = position.shelf.slots[position.slotIndex];
    if (!content) {
      continue;
    }
    position.shelf.slots[position.slotIndex] = {
      itemTypeId: content.itemTypeId,
      hidden: true
    };
  }
}

function collectSolutionTokenIds(
  board: BoardState,
  solution: readonly PlannedMove[]
): Set<string> | null {
  let current = cloneBoard(board);
  const tokenIds = new Set<string>();

  for (const move of solution) {
    const source = current.shelves.find(
      (shelf) => shelf.id === move.fromShelfId
    );
    if (!source) {
      throw new Error(`Solution source ${move.fromShelfId} not found.`);
    }

    const group = getTopGroup(current, move.fromShelfId);
    if (!group || group.itemTypeId !== move.expectedItemTypeId) {
      throw new Error('Generated solution does not match its source board.');
    }
    for (let index = group.startIndex; index <= group.topIndex; index += 1) {
      const tokenId = source.slots[index]?.tokenId;
      if (tokenId) {
        tokenIds.add(tokenId);
      }
    }

    const moved = moveTopGroup(
      current,
      move.fromShelfId,
      move.toShelfId,
      move.expectedCount
    );
    if (!moved.ok) {
      if (moved.reason === 'SOURCE_SHELF_COMPLETED') {
        return null;
      }
      throw new Error(`Generated solution move failed: ${moved.reason}.`);
    }
    current = moved.board;
  }

  return tokenIds;
}

function generateLevelInternal(
  config: LevelConfig,
  seed: number,
  depth: number
): GeneratedLevel {
  const configErrors = validateLevelConfig(config);
  if (configErrors.length > 0) {
    throw new Error(configErrors.join('\n'));
  }

  const random = createRandom(seed);
  const board = createSolvedBoard(config);
  const forwardMoves: PlannedMove[] = [];
  const targetScrambleMoves = config.shelfCount * config.capacity * 2;

  let scrambleMoves = 0;
  let attempts = 0;
  const maxAttempts = targetScrambleMoves * 20;

  while (
    scrambleMoves < targetScrambleMoves &&
    attempts < maxAttempts
  ) {
    attempts += 1;
    const move = findInverseMove(board, random);
    if (!move) {
      continue;
    }

    if (
      !applyInverseMove(
        board,
        move.sourceShelfId,
        move.targetShelfId,
        move.count
      )
    ) {
      continue;
    }

    forwardMoves.push({
      fromShelfId: move.targetShelfId,
      toShelfId: move.sourceShelfId,
      expectedItemTypeId: move.itemTypeId,
      expectedCount: move.count
    });
    scrambleMoves += 1;
  }

  const solution = [...forwardMoves].reverse();
  const eligibleTokenIds = collectSolutionTokenIds(board, solution);
  if (!eligibleTokenIds) {
    if (depth >= 16) {
      throw new Error(
        `Unable to generate a lock-compatible level ${config.id} with seed ${seed}.`
      );
    }

    const nextSeed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return generateLevelInternal(config, nextSeed, depth + 1);
  }

  let lastReason = 'No valid box placement was found.';
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const candidateBoard = cloneBoard(board);
    replaceRandomItemsWithBoxes(
      candidateBoard,
      config.boxCount,
      random,
      eligibleTokenIds
    );

    const candidate: GeneratedLevel = {
      config,
      seed,
      board: candidateBoard,
      solution
    };
    const verification = verifyGeneratedLevel(candidate);
    if (verification.ok) {
      return candidate;
    }
    lastReason = verification.reason ?? lastReason;
  }

  if (depth >= 16) {
    throw new Error(
      `Unable to generate verified level ${config.id} with seed ${seed}: ${lastReason}`
    );
  }

  const nextSeed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return generateLevelInternal(config, nextSeed, depth + 1);
}

export function generateLevel(
  config: LevelConfig,
  seed = config.generationSeed ?? config.id
): GeneratedLevel {
  return generateLevelInternal(config, seed >>> 0, 0);
}

function openTopBoxes(
  board: BoardState,
  shelfId: string
): BoardState {
  let current = board;
  while (true) {
    const shelf = current.shelves.find((candidate) => candidate.id === shelfId);
    if (!shelf) {
      return current;
    }

    const topIndex = getTopIndex(shelf);
    const top = topIndex >= 0 ? shelf.slots[topIndex] : null;
    if (!top || !top.hidden) {
      return current;
    }

    const opened = openTopBox(current, shelfId);
    if (!opened.ok) {
      return current;
    }
    current = opened.board;
  }
}

export function verifyGeneratedLevel(
  generated: GeneratedLevel
): VerificationResult {
  let board = cloneBoard(generated.board);

  for (const move of generated.solution) {
    board = openTopBoxes(board, move.fromShelfId);
    board = openTopBoxes(board, move.toShelfId);

    let remaining = move.expectedCount;
    while (remaining > 0) {
      board = openTopBoxes(board, move.fromShelfId);
      const group = getTopGroup(board, move.fromShelfId);
      if (!group) {
        return {
          ok: false,
          reason: `No movable top group on ${move.fromShelfId}.`
        };
      }
      if (group.itemTypeId !== move.expectedItemTypeId) {
        return {
          ok: false,
          reason: `Expected ${move.expectedItemTypeId}, found ${group.itemTypeId}.`
        };
      }
      const targetShelf = board.shelves.find(
        (shelf) => shelf.id === move.toShelfId
      );
      if (!targetShelf) {
        return { ok: false, reason: `Target ${move.toShelfId} not found.` };
      }

      const moveCount = Math.min(
        group.count,
        remaining,
        getFreeSlotCount(targetShelf)
      );
      if (moveCount <= 0) {
        return { ok: false, reason: `Target ${move.toShelfId} is full.` };
      }

      const moved = moveTopGroup(
        board,
        move.fromShelfId,
        move.toShelfId,
        moveCount
      );
      if (!moved.ok) {
        return {
          ok: false,
          reason: `Planned move failed: ${moved.reason}.`
        };
      }

      board = moved.board;
      remaining -= moveCount;
    }
  }

  if (!isWon(board)) {
    return { ok: false, reason: 'Solution replay did not reach a win state.' };
  }

  return { ok: true };
}

export function countHiddenItems(board: BoardState): number {
  let total = 0;
  for (const shelf of board.shelves) {
    for (const slot of shelf.slots) {
      if (slot?.hidden) {
        total += 1;
      }
    }
  }
  return total;
}

export function countItems(board: BoardState): Map<string, number> {
  const counts = new Map<string, number>();
  for (const shelf of board.shelves) {
    for (const slot of shelf.slots) {
      if (!slot) {
        continue;
      }
      counts.set(slot.itemTypeId, (counts.get(slot.itemTypeId) ?? 0) + 1);
    }
  }
  return counts;
}

export function getVisibleSlotContents(board: BoardState): SlotContent[] {
  const contents: SlotContent[] = [];
  for (const shelf of board.shelves) {
    for (const slot of shelf.slots) {
      if (slot) {
        contents.push(slot);
      }
    }
  }
  return contents;
}
