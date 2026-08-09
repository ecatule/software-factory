export interface StoredObjectRef {
  key: string;
  url: string;
}

/**
 * spec Assumptions/research.md §8: holds binary artifacts only. Specification
 * documents live in Postgres (SpecificationVersion.content), not here.
 */
export interface StorageProvider {
  put(key: string, content: Buffer, contentType: string): Promise<StoredObjectRef>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
}

export const STORAGE_PROVIDER = Symbol("STORAGE_PROVIDER");
