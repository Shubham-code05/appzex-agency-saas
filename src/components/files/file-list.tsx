import { Download, File, FileArchive, FileImage, FileSpreadsheet, FileText, Presentation, type LucideIcon } from "lucide-react";
import { fileDownloadHref, fileKind, formatBytes, type FileKind } from "@/lib/files-meta";
import { formatDate } from "@/lib/dates";

const KIND_ICON: Record<FileKind, { Icon: LucideIcon; tone: string }> = {
  image: { Icon: FileImage, tone: "bg-fuchsia-50 text-fuchsia-600" },
  pdf: { Icon: FileText, tone: "bg-rose-50 text-rose-600" },
  sheet: { Icon: FileSpreadsheet, tone: "bg-emerald-50 text-emerald-600" },
  slides: { Icon: Presentation, tone: "bg-orange-50 text-orange-600" },
  doc: { Icon: FileText, tone: "bg-sky-50 text-sky-600" },
  archive: { Icon: FileArchive, tone: "bg-amber-50 text-amber-600" },
  text: { Icon: FileText, tone: "bg-slate-100 text-slate-600" },
  other: { Icon: File, tone: "bg-slate-100 text-slate-600" },
};

export interface FileListItem {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  uploadedBy: { name: string } | null;
  /** e.g. "Task: Build pages" — shown under the name. */
  context?: string | null;
}

/**
 * Renders files with a permission-checked download link (/api/files/[id]).
 * `renderActions` lets the agency view add a sharing toggle per row.
 */
export function FileList<T extends FileListItem>({
  files,
  renderActions,
  empty = "No files yet.",
}: {
  files: T[];
  renderActions?: (file: T) => React.ReactNode;
  empty?: string;
}) {
  if (files.length === 0) return <p className="text-sm text-slate-500">{empty}</p>;

  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
      {files.map((file) => {
        const { Icon, tone } = KIND_ICON[fileKind(file.mimeType)];
        return (
          <li key={file.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                <Icon className="h-4.5 w-4.5" aria-hidden />
              </span>
              <div className="min-w-0">
                <a
                  href={fileDownloadHref(file.id)}
                  className="block truncate text-sm font-medium text-slate-900 hover:text-indigo-600"
                  title={file.fileName}
                >
                  {file.fileName}
                </a>
                <p className="truncate text-xs text-slate-500">
                  {formatBytes(file.sizeBytes)} · {formatDate(file.createdAt)}
                  {file.uploadedBy && ` · ${file.uploadedBy.name}`}
                  {file.context && ` · ${file.context}`}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {renderActions?.(file)}
              <a
                href={fileDownloadHref(file.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <Download className="h-4 w-4" aria-hidden />
                Download
              </a>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
