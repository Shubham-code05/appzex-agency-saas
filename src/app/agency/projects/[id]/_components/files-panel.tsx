import { Eye } from "lucide-react";
import { FileList } from "@/components/files/file-list";
import { FileShareToggle } from "@/components/files/file-share-toggle";
import { UploadFileForm } from "@/components/files/upload-file-form";
import { feedbackTitle } from "@/lib/feedback";

interface ProjectFile {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  isSharedWithClient: boolean;
  uploadedBy: { name: string } | null;
  task: { title: string } | null;
  feedback: { title: string; content: string } | null;
}

export function FilesPanel({
  projectId,
  clientName,
  files,
  tasks,
}: {
  projectId: string;
  clientName: string;
  files: ProjectFile[];
  tasks: { id: string; title: string }[];
}) {
  const sharedCount = files.filter((file) => file.isSharedWithClient).length;
  const rows = files.map((file) => ({
    ...file,
    context: file.feedback ? `Request: ${feedbackTitle(file.feedback)}` : file.task ? `Task: ${file.task.title}` : null,
  }));

  return (
    <section aria-label="Files" className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Upload a file</h2>
        <p className="mb-4 text-xs text-slate-500">Files are internal by default. Tick “Visible to client” to share with {clientName}.</p>
        <UploadFileForm projectId={projectId} tasks={tasks} />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            All files <span className="font-normal text-slate-400">{files.length}</span>
          </h2>
          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
            <Eye className="h-3.5 w-3.5 text-teal-600" aria-hidden />
            {sharedCount} shared with client
          </span>
        </div>
        <FileList
          files={rows}
          empty="No files uploaded yet."
          renderActions={(file) => <FileShareToggle fileId={file.id} fileName={file.fileName} shared={file.isSharedWithClient} />}
        />
      </div>
    </section>
  );
}
