# Appzex — Multi-Tenant Agency Project Management SaaS

A production-grade workspace where **digital agencies** run client projects and **their clients** follow progress, review deliverables and request changes — with a **platform owner** overseeing every tenant. Built on the Next.js App Router with MySQL + Prisma, and designed around one non-negotiable rule: **no user can ever read or change another tenant's data**, no matter what they put in a URL or request body.

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js) ![React](https://img.shields.io/badge/React-19-149eca?logo=react) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript) ![Prisma](https://img.shields.io/badge/Prisma-6-2d3748?logo=prisma) ![MySQL](https://img.shields.io/badge/MySQL-8-4479a1?logo=mysql&logoColor=white) ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?logo=tailwindcss)

---

## Table of contents

1. [Live demo & credentials](appzex-agency-saas-922k.vercel.app)
2. [Five-minute evaluator tour](#-five-minute-evaluator-tour)
3. [Features by role](#-features-by-role)
4. [Architecture](#-architecture)
5. [Multi-tenancy & security](#-multi-tenancy--security)
6. [AI features](#-ai-features)
7. [Tech stack](#-tech-stack)
8. [Getting started](#-getting-started)
9. [Project structure](#-project-structure)
10. [Deployment notes](#-deployment-notes)
11. [Known limitations](#-known-limitations)
12. [Roadmap](#-roadmap)

---

## 🌐 Live demo & credentials

**Live URL:** `https://appzex-agency-saas-922k.vercel.app/` <!-- TODO: replace with the deployed URL before submission -->

The login page has **one-click "Quick demo credentials"** buttons that pre-fill any account below. Every account uses the password **`Password123!`**.

| Role | Email | Tenant | What it demonstrates |
| --- | --- | --- | --- |
| Super Admin | `superadmin@appzex.com` | Platform | All agencies, status controls, Support Mode |
| Agency 1 Admin | `admin@apex.com` | Apex Digital | Full agency workspace, AI features |
| Agency 1 Team Member | `dev@apex.com` | Apex Digital | Same workspace, team role |
| Agency 1 Client | `client@nexus.com` | Apex Digital → Nexus Corp | Client portal, selective sharing, change requests |
| Agency 2 Admin | `admin@zenith.com` | Zenith Creative | A second, fully isolated tenant |
| Agency 2 Client | `client@acme.com` | Zenith Creative → Acme Ltd | Client isolation across agencies |
| Suspended Agency Admin | `admin@ghost.com` | Ghost Labs (**SUSPENDED**) | Login rejected with *"Your agency account is suspended"* |

> The seed data is designed as a test fixture: Apex's project has **exactly 4 tasks (2 done → 50%)**, one overdue and one due this week; it has both **shared and internal-only** meetings and files; Zenith's records are prefixed `[ZENITH]` / `[ACME]` so any cross-tenant leak would be obvious on screen.

---

## 🧭 Five-minute evaluator tour

1. **Suspension:** sign in as `admin@ghost.com` → rejected with HTTP 403 *"Your agency account is suspended"*.
2. **Agency workspace:** sign in as `admin@apex.com` → *Projects → Nexus Corp Website Redesign*. Progress reads **50%**. Tick the overdue task → the header jumps to **75%** instantly (derived from tasks, never stored).
3. **AI:** on the same project click **AI Project Health** (drawer with a Green/Amber/Red report), then *Meetings → "Content & launch planning call" → AI Extract Tasks* → review, edit and **Add to project**.
4. **Cross-tenant tampering:** copy the project URL, sign in as `admin@zenith.com` and paste it → **404**. Try `GET /api/agencies/<apex-agency-id>/projects` → **403**.
5. **Client portal:** sign in as `client@nexus.com`. You see the shared *Sprint review* meeting and shared files, but **not** the `[INTERNAL]` meeting or `INTERNAL-nexus-cost-estimate.csv`. Submit a change request; visiting `/agency` redirects you back to `/client`.
6. **Support Mode:** sign in as `superadmin@appzex.com` → *Agencies → Enter Agency (Support Mode)* on Apex. An amber banner appears on every page; exit returns you to the agency list. Both events are in the audit feed. Suspend Zenith and watch `admin@zenith.com`'s open session get rejected on its next request.

---

## ✨ Features by role

### Super Admin (platform owner)
- Platform dashboard: agencies by status, users by role, clients, projects, and an audit feed of status changes and support sessions.
- Agency table with search (name or admin email), status filter, pagination and inline **ACTIVE / INACTIVE / SUSPENDED** control. Suspension takes effect on the agency's users' **very next request**.
- **Support Mode** — enter any agency's workspace for troubleshooting, behind a persistent banner, fully audited.

### Agency Admin & Team
- Dashboard: active projects, clients, task totals split into **Overdue / Due this week / Completed**, a "needs attention" list, and an activity feed.
- **Clients** — list and add client companies.
- **Projects** — cards with client, status, due date and a **real derived progress bar** (`done ÷ total`).
- **Project detail** — Kanban (To do / In progress / Done) with overdue and due-this-week badges and filters, quick task creation, one-click status toggles with optimistic UI; **Meetings** with notes and a per-meeting *share with client* switch; **Files** with upload, task linking and a per-file *share with client* switch.
- **Feedback inbox** — "Needs reply" triage, workflow `OPEN → IN_REVIEW → IN_PROGRESS → RESOLVED / DECLINED` (declining requires a reason), official replies and attachments.
- **AI Project Health** and **AI meeting-notes → tasks** (see [AI features](#-ai-features)).
- Team workload and feedback overview pages.

### Client
- A distinct, calm portal (top navigation, teal accent) with a welcome dashboard: *replies to review*, *open requests*, *upcoming meetings*, project cards with progress and next milestones, and a timeline of client-visible updates.
- Project page: status, completion %, milestones, **shared** meetings with notes, **shared** files, timeline, and the client's own requests.
- **Change requests**: submit with an optional attachment, follow a two-way conversation, reply and attach files.

---

## 🏗 Architecture

```mermaid
flowchart LR
    B[Browser] -->|HTTP-only auth_token cookie| M["Edge middleware<br/>(verify JWT, role → route prefix)"]
    M --> P["Server Components & Server Actions<br/>(re-validate user + agency in DB)"]
    B -->|/api/* bypasses middleware| R["Route handlers<br/>/api/files · /api/ai/* · /api/auth/*"]
    P --> G["Guards (lib/auth.ts)<br/>requireAgencyWorkspace · requireClientContext · requireSuperAdmin"]
    R --> G
    G --> Q["Tenant-scoped Prisma queries<br/>(agencyId / clientId in every WHERE)"]
    Q --> DB[(MySQL)]
    R --> S[(Local object storage<br/>./storage)]
    R --> AI["LLM provider (optional)<br/>Groq · OpenAI"]
```

Key design decisions:

- **Three independent layers of authorization.** Middleware is a fast first filter; guards re-check the user against the database on every request; and the queries themselves are scoped by tenant. Any one layer failing is not enough to leak data.
- **The JWT proves identity only.** Role, tenant and agency status are re-read from MySQL on each request (memoised per request with React `cache()`), so suspensions and role changes apply immediately rather than when the token expires.
- **Server Actions for mutations, route handlers for binary/streaming/AI endpoints.** Every action returns a typed `ActionResult` with field-level errors.
- **Derived, never stored, progress.** `deriveProgress(tasks)` is the single source of truth, used by the agency UI, client portal, AI health check and seed invariants.

---

## 🔐 Multi-tenancy & security

### 1. Isolation is enforced at the query level

The tenant never comes from the client. Every guard resolves it from the verified session, and every query puts it in the `WHERE` clause:

```ts
// Agency side — src/app/agency/projects/[id]/page.tsx
const workspace = await requireAgencyWorkspace();          // agencyId from session (or Support Mode)
const project = await prisma.project.findFirst({
  where: { id, agencyId: workspace.agencyId },             // ownership IS the query
});
if (!project) notFound();

// Tasks have no agencyId column — they are always reached through their project
await tx.task.findFirst({ where: { id: taskId, project: { agencyId: workspace.agencyId } } });

// Client side — both the client record AND its agency
await prisma.project.findFirst({ where: { id, clientId: ctx.clientId, agencyId: ctx.agencyId } });
```

Referenced ids inside a mutation (the client of a new project, a task's assignee, a file's task/feedback) are re-checked against the same tenant **inside the same transaction** as the write.

### 2. URL / payload tampering is rejected

- A foreign id is **indistinguishable from a missing one**: pages return `404`, actions return *"not found"*, and `/api/files/[id]` returns `404`. Attackers cannot even confirm that another tenant's record exists.
- `enforceTenantAccess(agencyId)` guards explicit tenant URLs such as `/api/agencies/:agencyId/projects` → `403` for any other agency.
- All inputs are validated with **Zod** (ids, enums, lengths, dates). Server Action arguments are treated as untrusted even when TypeScript types say otherwise.

### 3. Authentication & sessions

- `bcryptjs` (cost 12); login compares against a dummy hash when the email is unknown, so response time does not reveal which emails exist.
- HS256 JWT (`jose`, issuer + audience checked) in an **HTTP-only, SameSite=Lax, Secure-in-production** cookie; 8-hour lifetime.
- Suspended/inactive agencies are refused at login **and** on every subsequent request; APIs answer `403 "Your agency account is suspended"`.
- Post-login redirects only honour same-site paths the role may access (no open redirect).
- `Origin` checks on the login and AI route handlers; Server Actions get Next.js' built-in origin check; logout is POST-only.

### 4. Support Mode (safe impersonation)

- Entering Support Mode issues a **separate, 1-hour signed token** (`support_session` cookie) bound to *this* super admin and *one* agency, with its own JWT audience — it can never be replayed as a login session, and vice versa.
- It grants nothing on its own: middleware and the DB-backed guards honour it **only alongside a valid SUPER_ADMIN session with the same user id**.
- A persistent banner — *"You are viewing [Agency] as Super Admin (Support Mode)"* — with an **Exit** button appears on every page.
- Entering, exiting, switching agencies and signing out mid-session are written to `ActivityLog`; every write made while impersonating is tagged `viaSupportMode` and shown with a *Support* badge in the agency's own feed. Clients see such actions attributed to the agency, never to platform staff.

### 5. Client isolation & selective sharing

- Middleware sends non-client roles away from `/client/*` and clients away from `/agency/*`; the guards re-check.
- Meetings and files are filtered with `isSharedWithClient: true` **in the database query**, so internal items never leave the server.
- The client timeline shows only `ActivityLog` rows flagged `isClientView`, and additionally drops meeting/file events whose item is no longer shared.

### 6. Files

- Stored **outside `/public`**; the only way to read one is `GET /api/files/[id]`, whose permission rule is itself a Prisma `WHERE` clause (agency member → own agency; client → shared files of own projects; super admin → impersonated agency only).
- Type allow-list by extension (browser MIME is ignored), 10 MB limit, sanitised names, random storage keys, path-traversal-proof storage driver.
- Always served as `attachment` with `nosniff` and a sandbox CSP, so uploaded content can never execute in the app's origin.

### 7. Other hardening

Security headers (`X-Frame-Options: DENY`, `nosniff`, strict referrer, permissions policy), `Cache-Control: no-store` on authenticated responses, a guard against running the destructive seed in production, and per-user rate limits on the AI endpoints.

---

## 🤖 AI features

Both features target real delivery pain: **turning meeting chatter into tracked work**, and **spotting a slipping project before the client does**.

### Feature A — Meeting notes → actionable tasks

| | |
| --- | --- |
| **Where** | Project → *Meetings* → **AI Extract Tasks** on any meeting's notes, or **Extract tasks from notes** to paste raw notes |
| **Endpoint** | `POST /api/ai/meeting-summary` `{ projectId, notes }` |
| **Output** | `{ mode, model, notice, tasks: [{ title, description, priority: LOW\|MEDIUM\|HIGH, suggestedDueDateDays }] }` |
| **Human in the loop** | Drafts are shown for review — untick, rename, re-prioritise or change due days — then **Add N tasks to project** calls the `createTasksFromAi` Server Action, which re-validates every field and inserts the tasks in one transaction. The AI endpoint itself never writes to the database. |

### Feature B — AI project health & risk check

| | |
| --- | --- |
| **Where** | Project header → **AI Project Health** (side drawer with loading skeleton, *Regenerate*, *Copy as Markdown*) |
| **Endpoint** | `POST /api/ai/project-health` `{ projectId }` |
| **Input facts** | Task counts, overdue and due-this-week tasks, workload per assignee, schedule position (progress vs. % of timeline elapsed), open milestones, and open client requests (including how long each has waited for a reply) |
| **Output** | Overall status **Green / Amber / Red**, headline, bottlenecks & overdue risks, recommended next steps, key metrics, and a ready-to-paste **Markdown** report |
| **Guardrail** | A deterministic rule engine computes a status *floor*. The LLM may **escalate** it but can never report a project healthier than the objective rules say. |

### Models, modes & graceful fallback

| Configuration | Behaviour |
| --- | --- |
| `GROQ_API_KEY` set | Groq, `llama-3.3-70b-versatile` (JSON mode) |
| `OPENAI_API_KEY` set | OpenAI, `gpt-4o-mini` (JSON mode) |
| `AI_MODEL` | Optional model override |
| **No key** | **Demo mode** — a built-in rule engine (action-verb and owner parsing, relative-date inference such as "by Friday" or "next week", priority keywords; RAG delivery rules for health). The UI clearly labels the result. |
| Provider error / timeout / malformed output | **Fallback mode** — same rule engine, with a notice explaining why |

Plain `fetch` against the OpenAI-compatible Chat Completions API — no SDK dependency, 30-second timeout.

### Tenant protection & AI safety

- Both endpoints require an agency session (`getAgencyWorkspaceOrThrow`); clients get `403`. The project is loaded with `agencyId` in the `WHERE` clause, and the health metrics are gathered **only** through that project, so the model can only ever see the caller's own data. Foreign ids → `404`.
- **Data minimisation:** the health check sends titles, statuses, dates and staff display names — no emails, descriptions or client message bodies.
- **Prompt-injection resistance:** user content is delimited and declared as untrusted data; the model has no tools and no write access; output is parsed with strict Zod schemas (coerced, clamped, truncated) and rendered as plain text — never as HTML.
- Per-user rate limit (20 requests / 10 minutes per endpoint); API keys stay server-side and are never logged, and neither are prompts.

---

## 🧰 Tech stack

| Layer | Choice |
| --- | --- |
| Framework | **Next.js 15** (App Router, Server Components, Server Actions, Edge middleware), **React 19**, **TypeScript** (strict) |
| Database | **MySQL 8** via **Prisma 6** |
| Styling | **Tailwind CSS 4**, **lucide-react** icons, native `<dialog>` modals and drawers |
| Auth | `jose` (HS256 JWT, edge-compatible), `bcryptjs` |
| Validation | **Zod 4** (forms, action arguments, API bodies, LLM output) |
| AI | Groq (`llama-3.3-70b-versatile`) or OpenAI (`gpt-4o-mini`) through the OpenAI-compatible REST API; rule-based fallback |
| Files | Pluggable storage driver (local disk by default) behind a permission-checked streaming endpoint |

---

## 🚀 Getting started

### Prerequisites
- Node.js **20+** (developed on 22)
- A MySQL 8 database (local, Docker, or hosted such as Aiven or PlanetScale)

### 1. Install

```bash
git clone <repo-url> appzex && cd appzex
npm install            # also runs `prisma generate`
```

### 2. Configure environment

Create `.env` (never commit it) using `.env.example` as the template:

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | `mysql://USER:PASSWORD@HOST:3306/DB` |
| `JWT_SECRET` | ✅ | ≥ 32 random characters — `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `ENABLE_DEMO_LOGIN` | – | `true` to show the demo-credential buttons in production builds (always shown in development) |
| `STORAGE_DIR` | – | Upload directory (default `./storage`); must be persistent |
| `GROQ_API_KEY` / `OPENAI_API_KEY` | – | Enables LLM mode for the AI features; without them the AI runs in demo mode |
| `AI_MODEL` | – | Optional model override |

### 3. Create the schema and seed demo data

```bash
npx prisma db push     # sync the schema to MySQL
npm run seed           # ⚠️ wipes all data, then loads the demo tenants
```

### 4. Run

```bash
npm run dev            # http://localhost:3000
```

### Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Develop, build (runs `prisma generate` first), serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:push` | Sync the Prisma schema to the database |
| `npm run seed` (alias `db:seed`) | Reset and seed demo data (refuses to run when `NODE_ENV=production` unless `ALLOW_DESTRUCTIVE_SEED=true`) |
| `npm run db:migrate` / `db:reset` | Prisma Migrate workflow |

---

## 🗂 Project structure

```text
prisma/
  schema.prisma            # Agency, User, Client, Project, Task, Milestone, Meeting,
                           # Feedback, FeedbackMessage, FileRecord, ActivityLog
  seed.ts                  # isolation-proof demo dataset with self-checking invariants
src/
  middleware.ts            # edge gate: JWT + role → route prefix, Support Mode entry
  actions/
    agency-actions.ts      # clients, projects, tasks, meetings, feedback review, files, AI batch create
    client-actions.ts      # change requests & replies (client-scoped)
  app/
    login/                 # login + quick demo credentials
    super-admin/           # dashboard, agencies, status + Support Mode actions
    agency/                # dashboard, projects/[id], clients, team, feedback/[id]
    client/                # portal dashboard, projects/[id], feedback/[id]
    api/auth/*             # login / logout
    api/files/[id]         # permission-checked file download
    api/ai/*               # meeting-summary, project-health
    api/agencies/[agencyId]/projects   # tenant-guarded JSON API
  components/              # app shell, badges, feedback thread, file list/upload, AI notice, UI kit
  lib/
    auth.ts                # session resolution + all guards
    jwt.ts · roles.ts      # edge-safe token & route rules
    ai/                    # LLM client, rule engines, meeting-tasks, project-health
    validation/            # Zod schemas (agency, portal, ai)
    storage.ts · uploads.ts · files-meta.ts
    feedback.ts · dates.ts · progress.ts · activity.ts · client-timeline.ts · rate-limit.ts
```

---

## ☁️ Deployment notes

- Any Node host with a **persistent disk** works out of the box (Railway, Render, Fly.io, a VPS or Docker). Set the environment variables above, run `npx prisma db push` (or migrations) once, then `npm run build && npm start`.
- **Vercel / serverless:** everything works except uploaded files, because the filesystem is ephemeral. Swap `src/lib/storage.ts` (four functions) for S3, R2 or GCS before relying on uploads there.
- Use a strong, unique `JWT_SECRET` per environment; rotating it signs everyone out.
- Keep `ENABLE_DEMO_LOGIN` unset for real customers.

---

## ⚠️ Known limitations

- **Single-instance rate limiting** — the in-memory limiter (AI endpoints) is per instance; use Redis or Upstash for horizontal scaling. Login is not yet rate-limited.
- **Local file storage** by default (see deployment notes); no virus scanning of uploads.
- **Sessions are stateless JWTs** — suspension and deletion apply instantly (DB re-check), but there is no per-device "log out everywhere" list.
- **Times are UTC** across the app; there are no per-user time zones yet.
- **No invitation or user-management UI** — users are created by the seed or directly in the database.
- **No committed automated test suite** — isolation, workflow and AI logic were verified with scripted checks during development; a Playwright and Vitest suite is the first roadmap item.
- `prisma db push` is used for speed; production should move to versioned `prisma migrate` migrations.

## 🗺 Roadmap

- [ ] Automated tests: Vitest for guards, schemas and rule engines; Playwright for cross-tenant tamper scenarios
- [ ] Invitations and user management (agency admins invite team and clients; password reset by email)
- [ ] S3-compatible storage driver with signed URLs, plus malware scanning
- [ ] Email and in-app notifications (new client request, reply, status change, overdue digest)
- [ ] Client approvals on milestones and deliverables
- [ ] Redis-backed rate limiting and session revocation list
- [ ] Per-user time zones and calendar (ICS) export for meetings
- [ ] AI: weekly auto-generated client status report, and a "similar past request" lookup for triage
- [ ] Row-level security or Prisma client extensions as an extra defence layer for tenant scoping

---

<sub>Built with Next.js, Prisma and a healthy paranoia about tenant boundaries.</sub>
