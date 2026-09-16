export type ItemTypeId = string;

export interface SlotContent {
  readonly itemTypeId: ItemTypeId;
  readonly hidden: boolean;
  readonly tokenId?: string;
}

export type Slot = SlotContent | null;
export type ShelfKind = 'main' | 'buffer';

export interface ShelfState {
  readonly id: string;
  readonly kind: ShelfKind;
  readonly capacity: number;
  readonly slots: Slot[];
}

export interface BoardState {
  readonly levelId: string;
  readonly shelves: ShelfState[];
}

export function cloneBoard(board: BoardState): BoardState {
  return {
    levelId: board.levelId,
    shelves: board.shelves.map((shelf) => ({
      id: shelf.id,
      kind: shelf.kind,
      capacity: shelf.capacity,
      slots: shelf.slots.map((slot) => (slot ? { ...slot } : null))
    }))
  };
}

export function createShelf(
  id: string,
  kind: ShelfKind,
  capacity: number
): ShelfState {
  return {
    id,
    kind,
    capacity,
    slots: Array.from({ length: capacity }, () => null)
  };
}
