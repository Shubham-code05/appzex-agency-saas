/** File-type rules shared by upload forms (client) and upload validation (server). */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Allowed extensions → the MIME type we store and serve. The browser-reported
 * type is never trusted; the extension decides, and downloads are always sent
 * as attachments with `nosniff`, so nothing uploaded can execute in the app origin.
 */
export const ALLOWED_EXTENSIONS: Readonly<Record<string, string>> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip",
};

export const ACCEPT_ATTRIBUTE = Object.keys(ALLOWED_EXTENSIONS)
  .map((ext) => `.${ext}`)
  .join(",");

export const ALLOWED_EXTENSIONS_LABEL = "PDF, images, Office documents, text/CSV or ZIP";

export function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type FileKind = "image" | "pdf" | "sheet" | "doc" | "slides" | "archive" | "text" | "other";

export function fileKind(mimeType: string): FileKind {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.includes("spreadsheet") || mimeType.includes("ms-excel") || mimeType === "text/csv") return "sheet";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "slides";
  if (mimeType.includes("wordprocessing") || mimeType === "application/msword") return "doc";
  if (mimeType === "application/zip") return "archive";
  if (mimeType.startsWith("text/")) return "text";
  return "other";
}

export function fileDownloadHref(fileId: string): string {
  return `/api/files/${encodeURIComponent(fileId)}`;
}
