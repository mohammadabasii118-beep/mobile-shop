import path from "node:path";
import { env } from "@/lib/server/env";
import { LocalStorageDriver } from "@/lib/server/storage/local";
import type { StorageDriver } from "@/lib/server/storage/types";

let driver: StorageDriver | undefined;

/** Publicly served images (product photos, logos, banners). Kept apart from the private receipt storage. */
export function getPublicStorage(): StorageDriver {
  if (!driver) driver = new LocalStorageDriver(path.join(env().UPLOAD_DIR, "public"));
  return driver;
}
