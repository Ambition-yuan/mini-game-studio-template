export const SAVE_SCHEMA_VERSION = 1;
export const SAVE_STORAGE_KEY = 'shelf-organizer.save.v1';

export interface SaveDataV1 {
  readonly schemaVersion: typeof SAVE_SCHEMA_VERSION;
  readonly highestUnlockedLevel: number;
  readonly selectedLevel: number;
  readonly completedLevels: readonly number[];
  readonly soundEnabled: boolean;
  readonly musicEnabled: boolean;
}

export type SaveLoadStatus =
  | 'missing'
  | 'loaded'
  | 'invalid'
  | 'unsupported';

export interface SaveLoadResult {
  readonly data: SaveDataV1;
  readonly status: SaveLoadStatus;
  readonly canWrite: boolean;
}

export function createDefaultSaveData(totalLevels: number): SaveDataV1 {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    highestUnlockedLevel: 1,
    selectedLevel: 1,
    completedLevels: [],
    soundEnabled: true,
    musicEnabled: true
  };
}

function clampLevel(value: number, totalLevels: number): number {
  return Math.max(1, Math.min(totalLevels, Math.floor(value)));
}

function normalizeCompletedLevels(
  value: unknown,
  totalLevels: number
): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(
    value
      .filter((entry): entry is number => (
        typeof entry === 'number' &&
        Number.isFinite(entry) &&
        Number.isInteger(entry) &&
        entry >= 1 &&
        entry <= totalLevels
      ))
  )].sort((left, right) => left - right);
}

export function decodeSaveData(
  raw: string | null,
  totalLevels: number
): SaveLoadResult {
  const defaults = createDefaultSaveData(totalLevels);
  if (raw === null) {
    return {
      data: defaults,
      status: 'missing',
      canWrite: true
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      data: defaults,
      status: 'invalid',
      canWrite: false
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      data: defaults,
      status: 'invalid',
      canWrite: false
    };
  }

  const value = parsed as Record<string, unknown>;
  if (value.schemaVersion !== SAVE_SCHEMA_VERSION) {
    return {
      data: defaults,
      status: 'unsupported',
      canWrite: false
    };
  }

  const highestUnlockedLevel = clampLevel(
    typeof value.highestUnlockedLevel === 'number'
      ? value.highestUnlockedLevel
      : defaults.highestUnlockedLevel,
    totalLevels
  );
  const selectedLevel = Math.min(
    highestUnlockedLevel,
    clampLevel(
      typeof value.selectedLevel === 'number'
        ? value.selectedLevel
        : defaults.selectedLevel,
      totalLevels
    )
  );

  return {
    data: {
      schemaVersion: SAVE_SCHEMA_VERSION,
      highestUnlockedLevel,
      selectedLevel,
      completedLevels: normalizeCompletedLevels(
        value.completedLevels,
        totalLevels
      ),
      soundEnabled: typeof value.soundEnabled === 'boolean'
        ? value.soundEnabled
        : defaults.soundEnabled,
      musicEnabled: typeof value.musicEnabled === 'boolean'
        ? value.musicEnabled
        : defaults.musicEnabled
    },
    status: 'loaded',
    canWrite: true
  };
}

export function encodeSaveData(data: SaveDataV1): string {
  return JSON.stringify(data);
}
