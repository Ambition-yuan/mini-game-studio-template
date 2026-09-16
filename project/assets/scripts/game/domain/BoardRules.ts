import {
  BoardState,
  cloneBoard,
  ShelfState,
  SlotContent
} from './BoardTypes';

export type RuleFailure =
  | 'SHELF_NOT_FOUND'
  | 'SOURCE_EMPTY'
  | 'SOURCE_TOP_IS_BOX'
  | 'TARGET_TOP_IS_BOX'
  | 'TARGET_TOP_TYPE_MISMATCH'
  | 'TARGET_FULL'
  | 'SAME_SHELF'
  | 'TOP_IS_NOT_BOX'
  | 'NO_TOP_CONTENT';

export type RuleResult =
  | { readonly ok: true; readonly board: BoardState }
  | { readonly ok: false; readonly reason: RuleFailure };

export interface TopGroup {
  readonly itemTypeId: string;
  readonly startIndex: number;
  readonly topIndex: number;
  readonly count: number;
}

export function findShelf(
  board: BoardState,
  shelfId: string
): ShelfState | undefined {
  return board.shelves.find((shelf) => shelf.id === shelfId);
}

export function getTopIndex(shelf: ShelfState): number {
  for (let index = shelf.capacity - 1; index >= 0; index -= 1) {
    if (shelf.slots[index] !== null) {
      return index;
    }
  }
  return -1;
}

export function getOccupiedCount(shelf: ShelfState): number {
  return getTopIndex(shelf) + 1;
}

export function getFreeSlotCount(shelf: ShelfState): number {
  return shelf.capacity - getOccupiedCount(shelf);
}

export function getTopGroup(
  board: BoardState,
  shelfId: string
): TopGroup | null {
  const shelf = findShelf(board, shelfId);
  if (!shelf) {
    return null;
  }

  const topIndex = getTopIndex(shelf);
  if (topIndex < 0) {
    return null;
  }

  const top = shelf.slots[topIndex];
  if (!top || top.hidden) {
    return null;
  }

  let startIndex = topIndex;
  while (startIndex > 0) {
    const candidate = shelf.slots[startIndex - 1];
    if (
      !candidate ||
      candidate.hidden ||
      candidate.itemTypeId !== top.itemTypeId
    ) {
      break;
    }
    startIndex -= 1;
  }

  return {
    itemTypeId: top.itemTypeId,
    startIndex,
    topIndex,
    count: topIndex - startIndex + 1
  };
}

export function openTopBox(
  board: BoardState,
  shelfId: string
): RuleResult {
  const shelf = findShelf(board, shelfId);
  if (!shelf) {
    return { ok: false, reason: 'SHELF_NOT_FOUND' };
  }

  const topIndex = getTopIndex(shelf);
  if (topIndex < 0) {
    return { ok: false, reason: 'NO_TOP_CONTENT' };
  }

  const top = shelf.slots[topIndex];
  if (!top) {
    return { ok: false, reason: 'NO_TOP_CONTENT' };
  }
  if (!top.hidden) {
    return { ok: false, reason: 'TOP_IS_NOT_BOX' };
  }

  const next = cloneBoard(board);
  const nextShelf = findShelf(next, shelfId);
  if (!nextShelf) {
    return { ok: false, reason: 'SHELF_NOT_FOUND' };
  }
  nextShelf.slots[topIndex] = {
    itemTypeId: top.itemTypeId,
    hidden: false,
    tokenId: top.tokenId
  };

  return { ok: true, board: next };
}

export function moveTopGroup(
  board: BoardState,
  fromShelfId: string,
  toShelfId: string,
  maxCount = Number.POSITIVE_INFINITY
): RuleResult {
  if (fromShelfId === toShelfId) {
    return { ok: false, reason: 'SAME_SHELF' };
  }

  const fromShelf = findShelf(board, fromShelfId);
  const toShelf = findShelf(board, toShelfId);
  if (!fromShelf || !toShelf) {
    return { ok: false, reason: 'SHELF_NOT_FOUND' };
  }

  const topIndex = getTopIndex(fromShelf);
  if (topIndex < 0) {
    return { ok: false, reason: 'SOURCE_EMPTY' };
  }

  const top = fromShelf.slots[topIndex];
  if (!top) {
    return { ok: false, reason: 'SOURCE_EMPTY' };
  }
  if (top.hidden) {
    return { ok: false, reason: 'SOURCE_TOP_IS_BOX' };
  }

  const targetTopIndex = getTopIndex(toShelf);
  if (targetTopIndex >= 0) {
    const targetTop = toShelf.slots[targetTopIndex];
    if (!targetTop) {
      return { ok: false, reason: 'SHELF_NOT_FOUND' };
    }
    if (targetTop.hidden) {
      return { ok: false, reason: 'TARGET_TOP_IS_BOX' };
    }
    if (targetTop.itemTypeId !== top.itemTypeId) {
      return { ok: false, reason: 'TARGET_TOP_TYPE_MISMATCH' };
    }
  }

  const freeSlots = getFreeSlotCount(toShelf);
  if (freeSlots <= 0) {
    return { ok: false, reason: 'TARGET_FULL' };
  }

  const group = getTopGroup(board, fromShelfId);
  if (!group) {
    return { ok: false, reason: 'SOURCE_TOP_IS_BOX' };
  }

  const requestedCount = Math.min(
    group.count,
    freeSlots,
    Math.max(0, Math.floor(maxCount))
  );
  if (requestedCount <= 0) {
    return { ok: false, reason: 'TARGET_FULL' };
  }

  const next = cloneBoard(board);
  const nextFrom = findShelf(next, fromShelfId);
  const nextTo = findShelf(next, toShelfId);
  if (!nextFrom || !nextTo) {
    return { ok: false, reason: 'SHELF_NOT_FOUND' };
  }

  for (let offset = 0; offset < requestedCount; offset += 1) {
    const sourceIndex = topIndex - offset;
    const content = nextFrom.slots[sourceIndex];
    if (!content || content.hidden) {
      return { ok: false, reason: 'SOURCE_TOP_IS_BOX' };
    }
    nextFrom.slots[sourceIndex] = null;
    nextTo.slots[targetTopIndex + 1 + offset] = {
      itemTypeId: content.itemTypeId,
      hidden: false,
      tokenId: content.tokenId
    };
  }

  return { ok: true, board: next };
}

export function isWon(board: BoardState): boolean {
  for (const shelf of board.shelves) {
    const occupied: SlotContent[] = [];
    for (const slot of shelf.slots) {
      if (slot) {
        occupied.push(slot);
      }
    }

    if (occupied.some((slot) => slot.hidden)) {
      return false;
    }

    if (shelf.kind === 'buffer' && occupied.length > 0) {
      return false;
    }

    if (shelf.kind === 'main') {
      const types = new Set(occupied.map((slot) => slot.itemTypeId));
      if (types.size > 1) {
        return false;
      }
    }
  }

  return true;
}

export function validateBoard(board: BoardState): string[] {
  const errors: string[] = [];
  const shelfIds = new Set<string>();

  for (const shelf of board.shelves) {
    if (shelfIds.has(shelf.id)) {
      errors.push(`Duplicate shelf id: ${shelf.id}`);
    }
    shelfIds.add(shelf.id);

    if (shelf.slots.length !== shelf.capacity) {
      errors.push(`Shelf ${shelf.id} slot count does not match capacity.`);
    }

    let foundEmpty = false;
    for (const slot of shelf.slots) {
      if (slot === null) {
        foundEmpty = true;
      } else if (foundEmpty) {
        errors.push(`Shelf ${shelf.id} contains a gap below the top.`);
        break;
      }
    }
  }

  return errors;
}
