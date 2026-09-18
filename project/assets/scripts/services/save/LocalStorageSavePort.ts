import {
  decodeSaveData,
  encodeSaveData,
  SAVE_STORAGE_KEY,
  SaveDataV1,
  SaveLoadResult
} from './SaveData';
import { SavePort } from './SavePort';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function getLocalStorage(): KeyValueStorage | null {
  try {
    const runtime = globalThis as typeof globalThis & {
      localStorage?: KeyValueStorage;
    };
    return runtime.localStorage ?? null;
  } catch {
    return null;
  }
}

export class LocalStorageSavePort implements SavePort {
  private readonly storage: KeyValueStorage | null;

  constructor(
    storage: KeyValueStorage | null = getLocalStorage(),
    private readonly storageKey = SAVE_STORAGE_KEY
  ) {
    this.storage = storage;
  }

  async load(totalLevels: number): Promise<SaveLoadResult> {
    try {
      return decodeSaveData(
        this.storage?.getItem(this.storageKey) ?? null,
        totalLevels
      );
    } catch {
      return decodeSaveData(null, totalLevels);
    }
  }

  async save(data: SaveDataV1): Promise<void> {
    this.storage?.setItem(this.storageKey, encodeSaveData(data));
  }
}
