import {
  decodeSaveData,
  encodeSaveData,
  SaveDataV1,
  SaveLoadResult
} from './SaveData';

export interface SavePort {
  load(totalLevels: number): Promise<SaveLoadResult>;
  save(data: SaveDataV1): Promise<void>;
}

export class MemorySavePort implements SavePort {
  private raw: string | null;

  constructor(initialRaw: string | null = null) {
    this.raw = initialRaw;
  }

  async load(totalLevels: number): Promise<SaveLoadResult> {
    return decodeSaveData(this.raw, totalLevels);
  }

  async save(data: SaveDataV1): Promise<void> {
    this.raw = encodeSaveData(data);
  }

  getRaw(): string | null {
    return this.raw;
  }
}
