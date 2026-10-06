import { env } from "@/lib/server/env";
import { LocalStorageDriver } from "@/lib/server/storage/local";
import type { StorageDriver } from "@/lib/server/storage/types";

let driver: StorageDriver | undefined;

export function getStorage(): StorageDriver {
  if (!driver) {
    switch (env().STORAGE_DRIVER) {
      case "local":
      default:
        driver = new LocalStorageDriver(env().UPLOAD_DIR);
    }
  }
  return driver;
}
