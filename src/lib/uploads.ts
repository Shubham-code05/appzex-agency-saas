import "server-only";
import { randomBytes } from "node:crypto";
import { ALLOWED_EXTENSIONS, ALLOWED_EXTENSIONS_LABEL, fileExtension, formatBytes, MAX_UPLOAD_BYTES } from "./files-meta";
import { deleteObject, putObject } from "./storage";

export class UploadError extends Error {}

export interface StoredUpload {
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

/** Returns the uploaded File for `key`, or null when the input was left empty. */
export function getOptionalFile(formData: FormData, key: string): File | null {
  const value = formData.get(key);
  if (!(value instanceof File) || value.size === 0) return null;
  return value;
}

/** Strips paths, control characters and reserved characters from a user-supplied name. */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(-150);
  return cleaned && cleaned !== "." && cleaned !== ".." ? cleaned : "file";
}

function asciiSlug(name: string): string {
  return (
    name
      .normalize("NFKD")
      .replace(/[^\w.-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "")
      .toLowerCase()
      .slice(-80) || "file"
  );
}

/**
 * Validates an upload and writes it to storage under the tenant's prefix.
 * Callers must create the FileRecord afterwards and call `discardUpload()` if
 * that DB write fails, so no orphaned objects are left behind.
 */
export async function storeUpload(file: File, scope: { agencyId: string; projectId: string }): Promise<StoredUpload> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError(`File is too large (${formatBytes(file.size)}). The limit is ${formatBytes(MAX_UPLOAD_BYTES)}.`);
  }

  const fileName = sanitizeFileName(file.name);
  const mimeType = ALLOWED_EXTENSIONS[fileExtension(fileName)];
  if (!mimeType) {
    throw new UploadError(`That file type isn't allowed. Upload ${ALLOWED_EXTENSIONS_LABEL}.`);
  }

  const storageKey = [
    "agencies",
    scope.agencyId,
    "projects",
    scope.projectId,
    `${Date.now()}-${randomBytes(8).toString("hex")}-${asciiSlug(fileName)}`,
  ].join("/");

  await putObject(storageKey, new Uint8Array(await file.arrayBuffer()));
  return { storageKey, fileName, mimeType, sizeBytes: file.size };
}

export async function discardUpload(upload: StoredUpload | null): Promise<void> {
  if (!upload) return;
  await deleteObject(upload.storageKey).catch((error: unknown) =>
    console.error("Failed to delete orphaned upload:", upload.storageKey, error),
  );
}
