export interface StoredObject { stream: ReadableStream<Uint8Array>; size: number }
/** A byte range [start, end] (inclusive) of a stored object, streamed without loading the file into memory. */
export interface StoredRange { stream: ReadableStream<Uint8Array>; size: number; start: number; end: number }

/** Private object storage. Keys are server-generated; there is never a public URL. */
export interface StorageDriver {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<StoredObject>;
  /** Streams a byte range; `end` is clamped to the file size. Used for video seeking on mobile. */
  getRange(key: string, start: number, end?: number): Promise<StoredRange>;
  delete(key: string): Promise<void>;
}
