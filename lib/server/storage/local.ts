import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageDriver, StoredObject } from "@/lib/server/storage/types";

const KEY_RE = /^[a-z0-9][a-z0-9/_.-]{0,200}$/i;

/** Private directory on disk (outside public/). Swap for an S3-compatible driver later without touching callers. */
export class LocalStorageDriver implements StorageDriver {
  private root: string;
  constructor(dir: string) {
    this.root = path.resolve(dir);
  }
  /** Rejects traversal (`..`), absolute paths and odd characters before touching the filesystem. */
  private resolve(key: string) {
    if (!KEY_RE.test(key) || key.includes("..") || key.includes("//")) throw new Error("Invalid storage key");
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error("Invalid storage key");
    return full;
  }
  async put(key: string, data: Buffer) {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true, mode: 0o700 });
    await writeFile(full, data, { mode: 0o600, flag: "wx" });
  }
  async get(key: string): Promise<StoredObject> {
    const full = this.resolve(key);
    const [buf, st] = await Promise.all([readFile(full), stat(full)]);
    return { size: st.size, stream: new Blob([new Uint8Array(buf)]).stream() };
  }
  async delete(key: string) {
    await rm(this.resolve(key), { force: true });
  }
}
