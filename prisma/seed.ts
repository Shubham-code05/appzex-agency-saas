/**
 * Multi-tenant isolation seed.
 *
 *   npm run db:seed        (→ prisma db seed → tsx prisma/seed.ts)
 *
 * WIPES all application tables, then creates three agencies designed to prove
 * tenant boundaries:
 *   - Apex Digital (ACTIVE)      admin, team member, client "Nexus Corp", 1 project @ exactly 50%
 *                                (one open task overdue, one due this week)
 *   - Zenith Creative (ACTIVE)   admin, client "Acme Ltd", 1 project with distinct tasks
 *   - Ghost Labs (SUSPENDED)     admin only — login must be rejected with 403
 *
 * Every account uses the password: Password123!
 */
import {
  AgencyStatus,
  FeedbackStatus,
  MilestoneStatus,
  PrismaClient,
  ProjectStatus,
  Role,
  TaskPriority,
  TaskStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { deriveProgress } from "../src/lib/progress";
import { deletePrefix, putObject } from "../src/lib/storage";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Password123!";
const BCRYPT_ROUNDS = 12;

function daysFromNow(days: number, hourUtc = 15): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(hourUtc, 0, 0, 0);
  return date;
}

function assertSafeToSeed(): void {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DESTRUCTIVE_SEED !== "true") {
    throw new Error(
      "Refusing to run the destructive seed with NODE_ENV=production. " +
        "Set ALLOW_DESTRUCTIVE_SEED=true if you really intend to wipe this database.",
    );
  }
}

/** Writes a real object to storage and creates its FileRecord, so downloads work. */
async function seedFile(input: {
  agencyId: string;
  projectId: string;
  fileName: string;
  mimeType: string;
  content: string;
  isSharedWithClient: boolean;
  uploadedById: string;
  taskId?: string;
  feedbackId?: string;
}) {
  const bytes = new TextEncoder().encode(input.content);
  const storageKey = `agencies/${input.agencyId}/projects/${input.projectId}/seed-${input.fileName}`;
  await putObject(storageKey, bytes);
  return prisma.fileRecord.create({
    data: {
      fileName: input.fileName,
      storageKey,
      mimeType: input.mimeType,
      sizeBytes: bytes.byteLength,
      isSharedWithClient: input.isSharedWithClient,
      projectId: input.projectId,
      taskId: input.taskId,
      feedbackId: input.feedbackId,
      uploadedById: input.uploadedById,
    },
  });
}

async function resetDatabase(): Promise<void> {
  // Children first so the wipe never depends on cascade ordering.
  await prisma.$transaction([
    prisma.activityLog.deleteMany(),
    prisma.fileRecord.deleteMany(),
    prisma.feedbackMessage.deleteMany(),
    prisma.feedback.deleteMany(),
    prisma.meeting.deleteMany(),
    prisma.milestone.deleteMany(),
    prisma.task.deleteMany(),
    prisma.project.deleteMany(),
    prisma.user.deleteMany(),
    prisma.client.deleteMany(),
    prisma.agency.deleteMany(),
  ]);
  // Uploaded objects of the wiped tenants.
  await deletePrefix("agencies");
}

async function seedSuperAdmin(passwordHash: string) {
  const superAdmin = await prisma.user.create({
    data: {
      email: "superadmin@appzex.com",
      name: "Platform Super Admin",
      role: Role.SUPER_ADMIN,
      passwordHash,
      agencyId: null,
    },
  });

  await prisma.activityLog.create({
    data: {
      action: "PLATFORM_SEEDED",
      entityType: "Platform",
      userId: superAdmin.id,
      metadata: { note: "Initial multi-tenant isolation dataset" },
    },
  });

  return superAdmin;
}

async function seedApexDigital(passwordHash: string) {
  const agency = await prisma.agency.create({
    data: { name: "Apex Digital", status: AgencyStatus.ACTIVE },
  });

  const admin = await prisma.user.create({
    data: {
      email: "admin@apex.com",
      name: "Alicia Park",
      role: Role.AGENCY_ADMIN,
      passwordHash,
      agencyId: agency.id,
    },
  });

  const dev = await prisma.user.create({
    data: {
      email: "dev@apex.com",
      name: "Devon Price",
      role: Role.AGENCY_TEAM,
      passwordHash,
      agencyId: agency.id,
    },
  });

  const client = await prisma.client.create({
    data: {
      name: "Nexus Corp",
      companyName: "Nexus Corporation",
      contactEmail: "client@nexus.com",
      agencyId: agency.id,
    },
  });

  const clientUser = await prisma.user.create({
    data: {
      email: "client@nexus.com",
      name: "Nadia Brooks",
      role: Role.CLIENT,
      passwordHash,
      agencyId: agency.id,
      clientId: client.id,
    },
  });

  // Exactly 4 tasks: 2 DONE + 2 TODO  →  derived progress = 50%.
  const project = await prisma.project.create({
    data: {
      name: "Nexus Corp Website Redesign",
      description:
        "Full redesign of the Nexus Corp marketing site: new design system, responsive pages and a headless CMS.",
      status: ProjectStatus.ACTIVE,
      startDate: daysFromNow(-30),
      endDate: daysFromNow(30),
      agencyId: agency.id,
      clientId: client.id,
      tasks: {
        create: [
          {
            title: "Discovery workshop & requirements sign-off",
            description: "Run stakeholder workshop and get written sign-off on scope.",
            status: TaskStatus.DONE,
            priority: TaskPriority.HIGH,
            dueDate: daysFromNow(-21),
            assigneeId: admin.id,
          },
          {
            title: "Design system & high-fidelity mockups",
            description: "Typography, colour tokens, components and desktop/mobile mockups.",
            status: TaskStatus.DONE,
            priority: TaskPriority.HIGH,
            dueDate: daysFromNow(-7),
            assigneeId: dev.id,
          },
          {
            title: "Build responsive marketing pages",
            description: "Implement Home, About, Services and Contact pages from approved mockups.",
            status: TaskStatus.TODO,
            priority: TaskPriority.HIGH,
            dueDate: daysFromNow(-2), // overdue → exercises the "Overdue" badge
            assigneeId: dev.id,
          },
          {
            title: "CMS integration & content migration",
            description: "Wire pages to the headless CMS and migrate existing blog content.",
            status: TaskStatus.TODO,
            priority: TaskPriority.MEDIUM,
            dueDate: daysFromNow(3), // → exercises the "Due this week" badge
            assigneeId: dev.id,
          },
        ],
      },
      milestones: {
        create: [
          {
            title: "Design approval",
            description: "Client approves the final mockups.",
            status: MilestoneStatus.COMPLETED,
            dueDate: daysFromNow(-7),
          },
          {
            title: "Public launch",
            description: "Production cut-over and DNS switch.",
            status: MilestoneStatus.PENDING,
            dueDate: daysFromNow(30),
          },
        ],
      },
      meetings: {
        create: [
          {
            title: "Sprint review with Nexus",
            notes: "Demo marketing pages progress; confirm CMS content owners.",
            isSharedWithClient: true,
            scheduledAt: daysFromNow(3, 14),
            durationMinutes: 45,
            meetingUrl: "https://meet.example.com/apex-nexus-review",
            organizerId: admin.id,
          },
          {
            // Raw notes for the "AI Extract Tasks" demo (internal-only).
            title: "Content & launch planning call",
            notes: [
              "Attendees: Nadia (Nexus), Alicia, Devon",
              "- Nadia to send final logo files and brand fonts by Friday",
              "- Devon will set up the staging environment tomorrow - blocker for CMS work",
              "- Alicia: prepare a revised launch timeline and share it with Nexus next week",
              "- Need to migrate 45 blog posts; Nexus to confirm which ones to archive within 5 days",
              "- Action: review Core Web Vitals on the new homepage before launch",
              "- Nice to have: add a dark mode toggle later",
            ].join("\n"),
            isSharedWithClient: false,
            scheduledAt: daysFromNow(-3, 15),
            durationMinutes: 60,
            organizerId: admin.id,
          },
          {
            // Internal-only: must NEVER appear in the Nexus client portal.
            title: "[INTERNAL] Sprint planning & margin review",
            notes: "Internal: discuss budget overrun on CMS migration before the client review.",
            isSharedWithClient: false,
            scheduledAt: daysFromNow(2, 9),
            durationMinutes: 30,
            organizerId: admin.id,
          },
        ],
      },
    },
    include: { tasks: { select: { id: true, title: true } } },
  });

  // Change request with a two-way thread: client asks, agency replies + moves it on.
  const feedback = await prisma.feedback.create({
    data: {
      title: "Make the homepage headline bolder",
      content: "Love the new homepage direction. Could the hero headline be a little bolder so it stands out on mobile?",
      rating: 5,
      status: FeedbackStatus.IN_REVIEW,
      projectId: project.id,
      authorId: clientUser.id,
      messages: {
        create: [
          {
            authorId: admin.id,
            body: "Thanks Nadia! We'll try a heavier weight and a larger mobile size and share options by Friday.",
            fromStatus: FeedbackStatus.OPEN,
            toStatus: FeedbackStatus.IN_REVIEW,
          },
        ],
      },
    },
  });

  const designTask = project.tasks.find((task) => task.title.startsWith("Design system"));
  await seedFile({
    agencyId: agency.id,
    projectId: project.id,
    fileName: "nexus-brand-brief.md",
    mimeType: "text/markdown",
    content: "# Nexus Corp brand brief\n\n- Primary colour: #0F766E\n- Tone: confident, plain-spoken\n",
    isSharedWithClient: true,
    uploadedById: clientUser.id,
  });
  const mockups = await seedFile({
    agencyId: agency.id,
    projectId: project.id,
    fileName: "homepage-mockup-notes.txt",
    mimeType: "text/plain",
    content: "Homepage mockup v2 - hero headline options A/B/C attached for review.\n",
    isSharedWithClient: true,
    uploadedById: dev.id,
    taskId: designTask?.id,
  });
  // Internal-only: must NEVER be listed or downloadable by the client.
  await seedFile({
    agencyId: agency.id,
    projectId: project.id,
    fileName: "INTERNAL-nexus-cost-estimate.csv",
    mimeType: "text/csv",
    content: "item,hours,rate\ndesign,40,120\ncms,60,110\n",
    isSharedWithClient: false,
    uploadedById: admin.id,
  });

  await prisma.activityLog.createMany({
    data: [
      {
        action: "PROJECT_CREATED",
        entityType: "Project",
        entityId: project.id,
        projectId: project.id,
        isClientView: true,
        agencyId: agency.id,
        userId: admin.id,
        metadata: { label: project.name },
        createdAt: daysFromNow(-30),
      },
      {
        action: "TASK_STATUS_CHANGED",
        entityType: "Task",
        entityId: designTask?.id,
        projectId: project.id,
        isClientView: true,
        agencyId: agency.id,
        userId: dev.id,
        metadata: { label: "Design system & high-fidelity mockups", from: "IN_PROGRESS", to: "DONE" },
        createdAt: daysFromNow(-7),
      },
      {
        action: "FILE_UPLOADED",
        entityType: "File",
        entityId: mockups.id,
        projectId: project.id,
        isClientView: true,
        agencyId: agency.id,
        userId: dev.id,
        metadata: { label: mockups.fileName, isSharedWithClient: true },
        createdAt: daysFromNow(-6),
      },
      {
        action: "FEEDBACK_SUBMITTED",
        entityType: "Feedback",
        entityId: feedback.id,
        projectId: project.id,
        isClientView: true,
        agencyId: agency.id,
        userId: clientUser.id,
        metadata: { label: feedback.title, byClient: true },
        createdAt: daysFromNow(-2),
      },
      {
        action: "FEEDBACK_STATUS_CHANGED",
        entityType: "Feedback",
        entityId: feedback.id,
        projectId: project.id,
        isClientView: true,
        agencyId: agency.id,
        userId: admin.id,
        metadata: { label: feedback.title, from: "OPEN", to: "IN_REVIEW", replied: true },
        createdAt: daysFromNow(-1),
      },
    ],
  });

  return { agency, admin, dev, client, clientUser, project };
}

async function seedZenithCreative(passwordHash: string) {
  const agency = await prisma.agency.create({
    data: { name: "Zenith Creative", status: AgencyStatus.ACTIVE },
  });

  const admin = await prisma.user.create({
    data: {
      email: "admin@zenith.com",
      name: "Marcus Reed",
      role: Role.AGENCY_ADMIN,
      passwordHash,
      agencyId: agency.id,
    },
  });

  const client = await prisma.client.create({
    data: {
      name: "Acme Ltd",
      companyName: "Acme Limited",
      contactEmail: "client@acme.com",
      agencyId: agency.id,
    },
  });

  const clientUser = await prisma.user.create({
    data: {
      email: "client@acme.com",
      name: "Alex Carter",
      role: Role.CLIENT,
      passwordHash,
      agencyId: agency.id,
      clientId: client.id,
    },
  });

  // Distinct titles from Apex so any cross-tenant leak is obvious in the UI/API.
  const project = await prisma.project.create({
    data: {
      name: "Acme Ltd Brand Refresh",
      description: "Brand audit, new logo system and a brand guidelines handbook for Acme Ltd.",
      status: ProjectStatus.ACTIVE,
      startDate: daysFromNow(-10),
      endDate: daysFromNow(45),
      agencyId: agency.id,
      clientId: client.id,
      tasks: {
        create: [
          {
            title: "[ZENITH] Competitor brand audit",
            description: "Review 8 competitor brands and summarise positioning gaps.",
            status: TaskStatus.DONE,
            priority: TaskPriority.MEDIUM,
            dueDate: daysFromNow(-3),
            assigneeId: admin.id,
          },
          {
            title: "[ZENITH] Logo concept exploration",
            description: "Three distinct logo routes with rationale.",
            status: TaskStatus.IN_PROGRESS,
            priority: TaskPriority.HIGH,
            dueDate: daysFromNow(7),
            assigneeId: admin.id,
          },
          {
            title: "[ZENITH] Brand guidelines handbook",
            description: "Usage rules, palette, typography and tone of voice.",
            status: TaskStatus.TODO,
            priority: TaskPriority.LOW,
            dueDate: daysFromNow(35),
            assigneeId: null,
          },
        ],
      },
      milestones: {
        create: [
          {
            title: "Logo route selected",
            status: MilestoneStatus.IN_PROGRESS,
            dueDate: daysFromNow(10),
          },
        ],
      },
      meetings: {
        create: [
          {
            title: "Acme logo concepts presentation",
            notes: "Internal dry-run before presenting the three logo routes.",
            isSharedWithClient: false,
            scheduledAt: daysFromNow(8, 10),
            durationMinutes: 60,
            meetingUrl: "https://meet.example.com/zenith-acme-logos",
            organizerId: admin.id,
          },
        ],
      },
      feedback: {
        create: [
          {
            title: "[ACME] Explore bolder colour options",
            content: "The audit was really thorough — keen to see bolder colour options.",
            rating: 4,
            status: FeedbackStatus.OPEN,
            authorId: clientUser.id,
          },
        ],
      },
    },
  });

  await seedFile({
    agencyId: agency.id,
    projectId: project.id,
    fileName: "acme-competitor-audit.md",
    mimeType: "text/markdown",
    content: "# [ACME] Competitor audit\n\nZenith-only document for isolation testing.\n",
    isSharedWithClient: true,
    uploadedById: admin.id,
  });

  await prisma.activityLog.create({
    data: {
      action: "PROJECT_CREATED",
      entityType: "Project",
      entityId: project.id,
      projectId: project.id,
      isClientView: true,
      agencyId: agency.id,
      userId: admin.id,
      metadata: { label: project.name },
    },
  });

  return { agency, admin, client, clientUser, project };
}

async function seedGhostLabs(passwordHash: string) {
  const agency = await prisma.agency.create({
    data: { name: "Ghost Labs", status: AgencyStatus.SUSPENDED },
  });

  const admin = await prisma.user.create({
    data: {
      email: "admin@ghost.com",
      name: "Grace Holt",
      role: Role.AGENCY_ADMIN,
      passwordHash,
      agencyId: agency.id,
    },
  });

  await prisma.activityLog.create({
    data: {
      action: "AGENCY_SUSPENDED",
      entityType: "Agency",
      entityId: agency.id,
      agencyId: agency.id,
      metadata: { reason: "Seeded as suspended to test login blocking" },
    },
  });

  return { agency, admin };
}

async function verifyIsolationDataset(apexProjectId: string, zenithProjectId: string): Promise<void> {
  const projects = await prisma.project.findMany({
    include: { agency: true, client: true, tasks: { select: { status: true } } },
    orderBy: { name: "asc" },
  });

  console.log("\nProjects:");
  for (const project of projects) {
    console.log(
      `  • [${project.agency.name}] ${project.name} (client: ${project.client.name}) — ` +
        `${project.tasks.length} tasks, ${deriveProgress(project.tasks)}% complete`,
    );
  }

  const apex = projects.find((p) => p.id === apexProjectId);
  if (!apex || apex.tasks.length !== 4 || deriveProgress(apex.tasks) !== 50) {
    throw new Error("Seed invariant failed: Apex project must have exactly 4 tasks at 50% progress.");
  }

  const zenith = projects.find((p) => p.id === zenithProjectId);
  if (!zenith || zenith.agencyId === apex.agencyId || zenith.clientId === apex.clientId) {
    throw new Error("Seed invariant failed: Zenith project must belong to a different tenant and client.");
  }

  // Selective sharing: Apex must have both shared and internal meetings/files.
  const [sharedMeetings, internalMeetings, sharedFiles, internalFiles] = await Promise.all([
    prisma.meeting.count({ where: { projectId: apexProjectId, isSharedWithClient: true } }),
    prisma.meeting.count({ where: { projectId: apexProjectId, isSharedWithClient: false } }),
    prisma.fileRecord.count({ where: { projectId: apexProjectId, isSharedWithClient: true } }),
    prisma.fileRecord.count({ where: { projectId: apexProjectId, isSharedWithClient: false } }),
  ]);
  if (!sharedMeetings || !internalMeetings || !sharedFiles || !internalFiles) {
    throw new Error("Seed invariant failed: Apex project needs shared AND internal meetings and files.");
  }
  console.log(
    `\nSelective sharing (Apex): ${sharedMeetings} shared / ${internalMeetings} internal meetings, ` +
      `${sharedFiles} shared / ${internalFiles} internal files`,
  );
}

async function main(): Promise<void> {
  assertSafeToSeed();

  console.log("Hashing demo password…");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS);

  console.log("Resetting database…");
  await resetDatabase();

  console.log("Seeding tenants…");
  await seedSuperAdmin(passwordHash);
  const apex = await seedApexDigital(passwordHash);
  const zenith = await seedZenithCreative(passwordHash);
  await seedGhostLabs(passwordHash);

  await verifyIsolationDataset(apex.project.id, zenith.project.id);

  console.log(`
Seed complete. All accounts use password: ${DEMO_PASSWORD}

  Role           Email                    Agency
  ─────────────  ───────────────────────  ────────────────────────
  SUPER_ADMIN    superadmin@appzex.com    —
  AGENCY_ADMIN   admin@apex.com           Apex Digital (ACTIVE)
  AGENCY_TEAM    dev@apex.com             Apex Digital (ACTIVE)
  CLIENT         client@nexus.com         Apex Digital → Nexus Corp
  AGENCY_ADMIN   admin@zenith.com         Zenith Creative (ACTIVE)
  CLIENT         client@acme.com          Zenith Creative → Acme Ltd
  AGENCY_ADMIN   admin@ghost.com          Ghost Labs (SUSPENDED → login 403)
`);
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
