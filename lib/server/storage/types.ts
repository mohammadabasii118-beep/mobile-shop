export interface StoredObject { stream: ReadableStream<Uint8Array>; size: number }

/** Private object storage. Keys are server-generated; there is never a public URL. */
export interface StorageDriver {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<StoredObject>;
  delete(key: string): Promise<void>;
}
