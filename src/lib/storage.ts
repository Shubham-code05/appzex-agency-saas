/**
 * Minimal object-storage driver backed by the local filesystem.
 *
 * Files live under STORAGE_DIR (default ./storage), OUTSIDE /public, so the
 * only way to read one is through /api/files/[id], which enforces permissions.
 * Swap this module for an S3/GCS implementation with the same four functions
 * when deploying to serverless hosts, whose disks are ephemeral.
 *
 * Deliberately free of `server-only` so the seed script (plain Node) can use it.
 */
import { createReadStream } from "node:fs";
import { mkdir, rm, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

export function storageRoot(): string {
  return path.resolve(process.env.STORAGE_DIR || path.join(process.cwd(), "storage"));
}

/** Maps a storage key to an absolute path, refusing anything that escapes the root. */
function resolveKey(key: string): string {
  const root = storageRoot();
  const fullPath = path.resolve(root, key);
  if (!fullPath.startsWith(root + path.sep)) throw new Error("Invalid storage key");
  return fullPath;
}

export async function putObject(key: string, data: Uint8Array): Promise<void> {
  const fullPath = resolveKey(key);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, data, { flag: "wx" }); // never overwrite an existing object
}

export async function openObjectStream(
  key: string,
): Promise<{ stream: ReadableStream<Uint8Array>; size: number } | null> {
  const fullPath = resolveKey(key);
  try {
    const info = await stat(fullPath);
    if (!info.isFile()) return null;
    const stream = Readable.toWeb(createReadStream(fullPath)) as unknown as ReadableStream<Uint8Array>;
    return { stream, size: info.size };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function deleteObject(key: string): Promise<void> {
  try {
    await unlink(resolveKey(key));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

/** Removes every object under a prefix (used by the dev seed only). */
export async function deletePrefix(prefix: string): Promise<void> {
  await rm(resolveKey(prefix), { recursive: true, force: true });
}
