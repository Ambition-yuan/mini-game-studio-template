export type TutorialRule = 'NO_BOX' | 'TOP_BOX' | 'SPLIT_MOVE';

export interface LevelItemCount {
  readonly itemTypeId: string;
  readonly count: number;
}

export interface LevelConfig {
  readonly id: number;
  readonly shelfCount: number;
  readonly capacity: number;
  readonly itemCounts: readonly LevelItemCount[];
  readonly boxCount: number;
  readonly tutorialRule?: TutorialRule;
  readonly generationSeed?: number;
}

export const MVP_LEVELS: readonly LevelConfig[] = [
  {
    id: 1,
    shelfCount: 4,
    capacity: 6,
    boxCount: 0,
    tutorialRule: 'NO_BOX',
    itemCounts: [
      { itemTypeId: 'apple', count: 6 },
      { itemTypeId: 'milk', count: 12 }
    ]
  },
  {
    id: 2,
    shelfCount: 6,
    capacity: 8,
    boxCount: 0,
    tutorialRule: 'NO_BOX',
    itemCounts: [
      { itemTypeId: 'apple', count: 8 },
      { itemTypeId: 'milk', count: 8 },
      { itemTypeId: 'cookie', count: 24 }
    ]
  },
  {
    id: 3,
    shelfCount: 6,
    capacity: 10,
    boxCount: 0,
    tutorialRule: 'NO_BOX',
    itemCounts: [
      { itemTypeId: 'apple', count: 10 },
      { itemTypeId: 'milk', count: 10 },
      { itemTypeId: 'cookie', count: 10 },
      { itemTypeId: 'juice', count: 20 }
    ]
  },
  {
    id: 4,
    shelfCount: 8,
    capacity: 10,
    boxCount: 0,
    tutorialRule: 'SPLIT_MOVE',
    itemCounts: [
      { itemTypeId: 'apple', count: 10 },
      { itemTypeId: 'milk', count: 10 },
      { itemTypeId: 'cookie', count: 20 },
      { itemTypeId: 'juice', count: 30 }
    ]
  },
  {
    id: 5,
    shelfCount: 8,
    capacity: 12,
    boxCount: 2,
    tutorialRule: 'TOP_BOX',
    itemCounts: [
      { itemTypeId: 'apple', count: 12 },
      { itemTypeId: 'milk', count: 24 },
      { itemTypeId: 'cookie', count: 24 },
      { itemTypeId: 'juice', count: 24 }
    ]
  },
  {
    id: 6,
    shelfCount: 8,
    capacity: 12,
    boxCount: 6,
    itemCounts: [
      { itemTypeId: 'apple', count: 12 },
      { itemTypeId: 'milk', count: 24 },
      { itemTypeId: 'cookie', count: 24 },
      { itemTypeId: 'juice', count: 24 }
    ]
  },
  {
    id: 7,
    shelfCount: 8,
    capacity: 12,
    boxCount: 10,
    itemCounts: [
      { itemTypeId: 'apple', count: 12 },
      { itemTypeId: 'milk', count: 24 },
      { itemTypeId: 'cookie', count: 24 },
      { itemTypeId: 'juice', count: 24 }
    ]
  },
  {
    id: 8,
    shelfCount: 8,
    capacity: 12,
    boxCount: 16,
    itemCounts: [
      { itemTypeId: 'apple', count: 12 },
      { itemTypeId: 'milk', count: 24 },
      { itemTypeId: 'cookie', count: 24 },
      { itemTypeId: 'juice', count: 24 }
    ]
  },
  {
    id: 9,
    shelfCount: 8,
    capacity: 12,
    boxCount: 20,
    itemCounts: [
      { itemTypeId: 'apple', count: 12 },
      { itemTypeId: 'milk', count: 24 },
      { itemTypeId: 'cookie', count: 24 },
      { itemTypeId: 'juice', count: 24 }
    ]
  },
  {
    id: 10,
    shelfCount: 8,
    capacity: 12,
    boxCount: 24,
    itemCounts: [
      { itemTypeId: 'apple', count: 12 },
      { itemTypeId: 'milk', count: 24 },
      { itemTypeId: 'cookie', count: 24 },
      { itemTypeId: 'juice', count: 24 }
    ]
  }
];

export function validateLevelConfig(config: LevelConfig): string[] {
  const errors: string[] = [];
  const totalCapacity = config.shelfCount * config.capacity;
  const expectedItemCount = (config.shelfCount - 1) * config.capacity;
  const actualItemCount = config.itemCounts.reduce(
    (total, item) => total + item.count,
    0
  );

  if (config.shelfCount < 2) {
    errors.push('shelfCount must be at least 2.');
  }
  if (config.capacity < 2) {
    errors.push('capacity must be at least 2.');
  }
  if (config.itemCounts.length === 0) {
    errors.push('At least one item type is required.');
  }
  if (config.itemCounts.length >= config.shelfCount) {
    errors.push('Item type count must be less than shelf count.');
  }
  if (config.itemCounts.length > 4) {
    errors.push('Item type count must not exceed 4 in the first version.');
  }
  if (actualItemCount !== expectedItemCount) {
    errors.push(
      `Item total ${actualItemCount} does not equal expected ${expectedItemCount}.`
    );
  }
  if (actualItemCount >= totalCapacity) {
    errors.push('The board must retain at least one empty slot.');
  }

  for (const item of config.itemCounts) {
    if (item.count <= 0) {
      errors.push(`Item ${item.itemTypeId} must have a positive count.`);
    }
    if (item.count % config.capacity !== 0) {
      errors.push(
        `Item ${item.itemTypeId} count must be divisible by capacity.`
      );
    }
  }

  if (config.boxCount < 0 || config.boxCount > actualItemCount) {
    errors.push('boxCount must be between 0 and the total item count.');
  }
  if (config.id <= 4 && config.boxCount !== 0) {
    errors.push('The first four levels must not contain boxes.');
  }

  return errors;
}
