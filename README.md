# Smart Form Builder

An original, Jotform-inspired online form builder: drag-and-drop form design, a
public form renderer, response collection with CSV export, and JWT auth — built
as a TypeScript monorepo (Next.js + Express + Prisma/PostgreSQL).

This is **Phases 1-2 of 8** on the roadmap: core form building/submission,
plus department-based roles and permissions. See [Roadmap](#roadmap) for
what's planned in each later phase.

## Stack

- **apps/web** — Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, react-dnd
- **apps/api** — Node.js, Express, TypeScript, Prisma, PostgreSQL, JWT auth
- **packages/shared** — TypeScript types shared by both apps

## Getting started

### Option A — Docker (recommended for a production-like setup)

1. Copy the env file and fill in real secrets:
   ```bash
   cp .env.example .env
   ```
2. Build and start everything:
   ```bash
   docker compose up --build
   ```
   This starts PostgreSQL, the API (migrations run automatically on boot), the
   Next.js app, and an Nginx reverse proxy on port 80.
3. Visit `http://localhost` (via Nginx) or `http://localhost:3000` (web
   directly) / `http://localhost:4000` (API directly).

### Option B — Local development without Docker

Requires Node.js 20+. If you don't have PostgreSQL installed, `npm run db:local`
downloads and runs a real Postgres instance for you — no admin rights needed.

```bash
npm install

# In one terminal: start (or point to) Postgres
npm run db:local --workspace apps/api    # no local Postgres? this spins one up on port 54329

# In apps/api: copy env, migrate, seed
cp apps/api/.env.example apps/api/.env   # edit DATABASE_URL if not using db:local
npm run prisma:migrate
npm run prisma:seed

# In apps/web:
cp apps/web/.env.example apps/web/.env.local

# Two more terminals:
npm run dev:api
npm run dev:web
```

Visit `http://localhost:3000`. Two seeded logins (both password `Demo1234!`):

- `demo@smartformbuilder.dev` — super admin, sees `/dashboard/admin`
- `colleague@smartformbuilder.dev` — regular user with an Editor role
  (view/create/edit, no delete) in the seeded "Operations" department

Also seeds one published "Contact Us" form (in Operations) and a "Contact
Form" template.

## Tests

```bash
# with the local/dev database running (npm run db:local, or docker compose up postgres)
npm run test:api
```

Covers the auth flow (register/login/refresh rotation/me), form CRUD,
ownership isolation, bulk field save with id-preserving upserts, publish/public
visibility, the public submission → response → CSV export path, and
department-wide permission boundaries (admin-route gating, view/edit/delete
enforcement, create-permission checks).

## Project structure

```
apps/web      Next.js app: builder, dashboard, public form pages
apps/api      Express API: auth, forms, fields, responses
packages/shared  Field/Form/Response TypeScript types shared by both apps
docker/       Dockerfiles + nginx.conf
```

## Security notes (Phase 1)

- Passwords hashed with bcrypt (cost 12).
- JWT access tokens (short-lived, in-memory only on the client) + rotating
  opaque refresh tokens (httpOnly, SameSite=Lax cookie, hashed at rest).
- CSRF mitigation: refresh/logout are the only cookie-authenticated endpoints;
  everything else requires an `Authorization: Bearer` header, which a
  cross-site page cannot forge. Combined with a strict CORS allowlist and
  SameSite=Lax, this covers CSRF without a separate token dance. Revisit if a
  browser-cookie-authenticated write endpoint is added later.
- express-rate-limit on auth and public submission endpoints.
- zod validation on every request body. Prisma parameterizes all queries.
- helmet default headers; no raw HTML/script injection points exist yet
  (Custom CSS/JS and HTML Block fields are deferred — see Roadmap).

## Roadmap

This roadmap was reordered after reviewing the client's Statement of Work
(Vital Technolabs, "Online Form Management System - NFI"): Roles/Permissions
and Approval Workflows moved up from the back of the queue because the SOW
treats both as core scope, and Platform/Admin/Storage moved ahead of Form
Settings and Sharing since this project reads as an internal operations tool
(departments, approval chains, product codes) rather than a public-facing form
SaaS.

### Phase 1 — Core foundation ✅ done

Auth (JWT access + rotating refresh tokens), drag-and-drop builder with 9
field types (Text, Paragraph, Email, Number, Phone, Date, Dropdown, Radio,
Checkbox), single-page forms, publish/public rendering, submission +
validation, responses table with search/CSV export, dashboard, Docker
deployment, API test suite. Also includes two post-launch fixes: the
dashboard's Create button no longer silently requires a title first (defaults
to "Untitled Form"), and delete confirmations use an in-app dialog instead of
the native `window.confirm()` popup, which browsers/extensions can silently
suppress.

### Phase 2 — Roles, Departments & Permissions ✅ done

Foundational — built first because Phase 3 (Approval Workflows) needs real
roles to assign approvers from, and retrofitting a permission system after
Phases 4-8 existed would have been far more disruptive.

Resolved with the client: role access is **department-wide** (a role grants
access to every form in that department, not per-form grants), and a user
**can hold multiple roles across multiple departments** at once.

- **Department** model: super-admin-managed, users are assigned to one or
  more via Membership
- **Custom Role** model: admin-defined (not a fixed enum) with a permission
  matrix — `canView` / `canCreate` / `canEdit` / `canDelete`
- **Membership** join model: (user, department, role) — a user can hold
  several
- Permission resolution (`apps/api/src/lib/permissions.ts`): the form owner
  and super admins always have full access; otherwise access is the union of
  every role the user holds in the form's department. A form with no
  department is private to its owner (original Phase 1 behavior)
- `User.isSuperAdmin` flag bypasses all checks — the minimal seed the full
  admin panel (Phase 6) builds on
- Forms API updated throughout: list/create/view/edit/delete/fields/responses
  all check resolved permissions instead of strict ownership; a form can be
  created private or under a department (creator needs `canCreate` there);
  `PATCH` can move a form between departments (checked the same way)
- Admin UI at `/dashboard/admin` (super-admin gated, both client- and
  server-side): manage departments, manage roles + permission matrix, assign
  members
- Dashboard: department badge on form cards, a department picker on create
  (only shown if the user can create in at least one), Edit/Delete controls
  hidden per the user's actual `canEdit`/`canDelete` on each form
- 7 new API tests covering admin-route gating and department-wide access
  boundaries (view/edit granted, delete correctly refused, forms hidden
  entirely from non-members, create blocked without `canCreate`)
- Seed data: demo user is now a super admin; a `colleague@smartformbuilder.dev`
  / `Demo1234!` user is seeded with an Editor role (view+create+edit, no
  delete) in a seeded "Operations" department, which the seeded "Contact Us"
  form belongs to — log in as both to see the permission boundary firsthand

### Phase 3 — Approval Workflows ⬜ not started

Depends on Phase 2. Matches SOW 2.4, which treats this as core scope
alongside form creation, not an optional add-on.

- Approval flow builder: attach one or more steps to a form, assign an
  approver (role or specific user) per step, sequential or parallel
- Submission status: Pending / Approved / Rejected
- Approver dashboard: items awaiting my decision, Approve / Reject / Request
  changes + comment
- Multi-level chains (SOW says "if required" — confirm whether v1 needs this
  or ships single-level first)
- Email notifications: approver on new item, submitter on decision
- Audit trail of who decided what, and when

### Phase 4 — Builder power features ⬜ not started

- Remaining field types: Address, Rating, Signature, Rich Text, Divider,
  Heading, HTML Block, Hidden, Calculation (File/Image Upload and Payment wait
  for Phase 6's storage/payment-provider work)
- **Linked/Lookup field** (SOW 2.2 "Database Linked form"): import a
  reference list (Excel/CSV) as a data source; bind a field to it with
  prefix-based autocomplete. Needs a clarified functional spec before
  estimating — open questions: is the dataset reusable across forms or
  scoped to one field, who can edit it, what happens with ambiguous prefixes
- **Product code naming** (SOW 2.7): tagging/identification metadata on
  forms/submissions
- Multi-page forms, progress bar, nested sections
- Conditional logic — single/multiple selection triggers (SOW 2.2/2.3)
- Undo/redo, multi-select, copy/paste, custom validation rules

### Phase 5 — Dashboard, Reporting & Data Lifecycle ⬜ not started

- Analytics charts: daily/monthly submissions, conversion rate, average
  completion time
- Per-column filtering, date-based filtering (SOW 2.5)
- Excel export, PDF export, print view (SOW 2.6)
- **Auto-archive** (SOW 2.7): needs a clarified spec before building — global
  setting or per-form? Does "archive" mean hidden-from-view or
  export-then-delete? Has data-retention/compliance implications if
  submissions contain personal data

### Phase 6 — Platform, Admin & Storage ⬜ not started

- Full admin panel: users, plans, billing, storage, logs, system settings,
  email templates
- OAuth login, 2FA
- S3-compatible file storage — unlocks File/Image Upload (Phase 4) and
  **Video reference support** (SOW 2.7 — embed/reference example product
  videos)
- Payment field (needs a payment provider, e.g. Stripe)

### Phase 7 — Form Settings & Anti-Spam ⬜ not started

- Theme system, Custom CSS/JS injection
- Password-protected forms, submission limits, submission scheduling,
  redirect URL
- Email notifications, autoresponders
- Spam protection, reCAPTCHA, Cloudflare Turnstile

### Phase 8 — Sharing & Templates ⬜ not started

- Templates gallery (beyond the one seeded "Contact Form")
- QR codes, iframe/popup/WordPress/HTML embeds
- Public API keys, webhooks, documented REST API (OpenAPI/Swagger)

## Gaps in the client SOW itself (not engineering work)

Separate from the phases above — these are things to get answered/added to
the actual Statement of Work document, not code to build: an out-of-scope
list, a real timeline (currently "to be defined"), pricing/payment
milestones, non-functional requirements (expected volume, security/
compliance, hosting/data residency), client responsibilities/RACI, a
change-request process, post-launch support/warranty terms, and IP/
confidentiality (may already live in a separate contract).
