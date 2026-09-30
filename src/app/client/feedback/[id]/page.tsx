import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FolderOpen } from "lucide-react";
import { requireClientContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { feedbackTitle } from "@/lib/feedback";
import { FeedbackStatusBadge } from "@/components/feedback/feedback-status-badge";
import { FeedbackThread } from "@/components/feedback/feedback-thread";
import { FileList } from "@/components/files/file-list";
import { ClientReplyForm } from "./_components/client-reply-form";

export const metadata: Metadata = { title: "Request" };
export const dynamic = "force-dynamic";

export default async function ClientFeedbackDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await requireClientContext();
  const { id } = await params;

  // A feedbackId belonging to another client resolves to "not found".
  const feedback = await prisma.feedback.findFirst({
    where: { id, project: { clientId: context.clientId, agencyId: context.agencyId } },
    select: {
      id: true,
      title: true,
      content: true,
      status: true,
      createdAt: true,
      author: { select: { name: true, role: true } },
      project: { select: { id: true, name: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          body: true,
          fromStatus: true,
          toStatus: true,
          createdAt: true,
          author: { select: { name: true, role: true } },
        },
      },
      files: {
        where: { isSharedWithClient: true },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          createdAt: true,
          uploadedBy: { select: { name: true, role: true } },
        },
      },
    },
  });
  if (!feedback) notFound();

  const files = feedback.files.map((file) => ({
    ...file,
    uploadedBy: file.uploadedBy
      ? { name: file.uploadedBy.role === "SUPER_ADMIN" ? context.agencyName : file.uploadedBy.name }
      : null,
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/client/feedback" className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-900">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All requests
      </Link>

      <header>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <FeedbackStatusBadge status={feedback.status} />
          <Link
            href={`/client/projects/${feedback.project.id}`}
            className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-teal-700"
          >
            <FolderOpen className="h-3.5 w-3.5" aria-hidden />
            {feedback.project.name}
          </Link>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{feedbackTitle(feedback)}</h1>
      </header>

      <FeedbackThread
        viewer="client"
        agencyName={context.agencyName}
        request={{ content: feedback.content, createdAt: feedback.createdAt, author: feedback.author }}
        messages={feedback.messages}
      />

      {files.length > 0 && (
        <section aria-labelledby="attachments-heading">
          <h2 id="attachments-heading" className="mb-3 text-sm font-semibold">
            Attachments
          </h2>
          <FileList files={files} />
        </section>
      )}

      <section aria-labelledby="reply-heading" className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 id="reply-heading" className="mb-3 text-sm font-semibold">
          Add a reply
        </h2>
        <ClientReplyForm feedbackId={feedback.id} />
      </section>
    </div>
  );
}
