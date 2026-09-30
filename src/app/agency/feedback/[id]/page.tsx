import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Briefcase, FolderKanban } from "lucide-react";
import { requireAgencyWorkspace } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { feedbackTitle, normalizeFeedbackStatus } from "@/lib/feedback";
import { FeedbackStatusBadge } from "@/components/feedback/feedback-status-badge";
import { FeedbackThread } from "@/components/feedback/feedback-thread";
import { FileList } from "@/components/files/file-list";
import { FileShareToggle } from "@/components/files/file-share-toggle";
import { UploadFileForm } from "@/components/files/upload-file-form";
import { FeedbackReviewForm } from "./_components/feedback-review-form";

export const metadata: Metadata = { title: "Feedback" };
export const dynamic = "force-dynamic";

export default async function AgencyFeedbackDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const workspace = await requireAgencyWorkspace();
  const { id } = await params;

  // Scoped through the parent project's agency: other tenants' items 404.
  const feedback = await prisma.feedback.findFirst({
    where: { id, project: { agencyId: workspace.agencyId } },
    select: {
      id: true,
      title: true,
      content: true,
      status: true,
      createdAt: true,
      author: { select: { name: true, role: true } },
      project: { select: { id: true, name: true, client: { select: { companyName: true } } } },
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
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          createdAt: true,
          isSharedWithClient: true,
          uploadedBy: { select: { name: true } },
        },
      },
    },
  });
  if (!feedback) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/agency/feedback"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All feedback
      </Link>

      <header>
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
          <FeedbackStatusBadge status={feedback.status} />
          <span className="inline-flex items-center gap-1">
            <Briefcase className="h-3.5 w-3.5" aria-hidden />
            {feedback.project.client.companyName}
          </span>
          <Link href={`/agency/projects/${feedback.project.id}`} className="inline-flex items-center gap-1 hover:text-indigo-600">
            <FolderKanban className="h-3.5 w-3.5" aria-hidden />
            {feedback.project.name}
          </Link>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{feedbackTitle(feedback)}</h1>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <FeedbackThread
            viewer="agency"
            agencyName={workspace.agencyName}
            request={{ content: feedback.content, createdAt: feedback.createdAt, author: feedback.author }}
            messages={feedback.messages}
          />

          <section aria-labelledby="review-heading" className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 id="review-heading" className="mb-4 text-sm font-semibold text-slate-900">
              Respond to client
            </h2>
            <FeedbackReviewForm feedbackId={feedback.id} currentStatus={normalizeFeedbackStatus(feedback.status)} />
          </section>
        </div>

        <aside className="space-y-4">
          <section aria-labelledby="attachments-heading">
            <h2 id="attachments-heading" className="mb-3 text-sm font-semibold text-slate-900">
              Attachments
            </h2>
            <FileList
              files={feedback.files}
              empty="No attachments."
              renderActions={(file) => (
                <FileShareToggle fileId={file.id} fileName={file.fileName} shared={file.isSharedWithClient} />
              )}
            />
          </section>
          <section aria-labelledby="attach-heading" className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 id="attach-heading" className="mb-3 text-sm font-semibold text-slate-900">
              Attach a file
            </h2>
            <UploadFileForm projectId={feedback.project.id} feedbackId={feedback.id} defaultShared />
          </section>
        </aside>
      </div>
    </div>
  );
}
