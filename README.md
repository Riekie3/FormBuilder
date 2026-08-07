# Smart Form Builder

An original, Jotform-inspired online form builder: drag-and-drop form design, a
public form renderer, response collection with CSV export, and JWT auth — built
as a TypeScript monorepo (Next.js + Express + Prisma/PostgreSQL).

This is **Phases 1-3 plus Phase 4a/4b of 8** on the roadmap: core form
building/submission, department-based roles and permissions, a single-level
approval workflow, 9 additional field types (Address, Rating, Signature,
Divider, Heading, HTML Block, Hidden, Rich Text, Calculation) plus product
code naming, and now multi-page forms with conditional field logic. See
[Roadmap](#roadmap) for what's planned in each later phase.

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
- `colleague@smartformbuilder.dev` — regular user holding two roles in the
  seeded "Operations" department: Editor (view/create/edit, no delete) and
  Approver

Also seeds one published "Contact Us" form (in Operations, requires approval
— submit it at `/f/contact-us-demo`, then approve/reject it from
`/dashboard/approvals` as `colleague@...`) and a "Contact Form" template.

## Tests

```bash
# with the local/dev database running (npm run db:local, or docker compose up postgres)
npm run test:api
```

Covers the auth flow (register/login/refresh rotation/me), form CRUD,
ownership isolation, bulk field save with id-preserving upserts, publish/public
visibility, the public submission → response → CSV export path,
department-wide permission boundaries (admin-route gating, view/edit/delete
enforcement, create-permission checks), and the approval workflow (opt-in
validation, submission status, decision authorization, the pending-approvals
aggregation). The auth/submission rate limiters are skipped under
`NODE_ENV=test` so test suites that legitimately register many accounts don't
throttle themselves.

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
- helmet default headers. The two raw-HTML-adjacent field types (Phase 4a) are
  both sanitized: the HTML Block field is passed through DOMPurify at render
  time (not at storage time, since the builder-authored HTML isn't trusted
  either), and the Rich Text field uses a hand-rolled safe-markdown renderer
  that HTML-escapes input first, then applies a small whitelist of regex
  transforms (bold/italic/http(s)-only links) — never raw HTML passthrough.
  The Calculation field's formula is evaluated by a hand-rolled recursive-
  descent arithmetic parser (`apps/web/src/lib/safeFormula.ts`), never
  `eval()`/`new Function()`, so a form-builder-authored formula string can't
  execute arbitrary code. Custom CSS/JS injection is still deferred — see
  Roadmap.

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

### Phase 3 — Approval Workflows ✅ done

Matches SOW 2.4. Resolved with the client: **single-level** approval for v1
(multi-level chains deferred), **opt-in per form** (a toggle in form
settings — existing forms are unaffected), and approvers assigned **by
role** (consistent with Phase 2's department-wide model).

- `Form.requiresApproval` + `Form.approverRoleId`: opt-in toggle, only
  settable once the form has a department (the approver role is resolved
  against Memberships in it)
- `Response.status` (Pending/Approved/Rejected, null when approval isn't
  used) + `decidedByUserId`/`decidedAt`/`decisionComment` for the audit trail
- Public submissions land as Pending automatically when the form requires
  approval; the thank-you screen reflects it ("...is pending review")
- Decision endpoint (`PATCH .../responses/:id/decision`): gated on
  `canDecideOnForm` — the form owner and super admins can always decide;
  otherwise the caller must hold the form's designated approver role in its
  department. A response can only be decided once (409 on replay)
- Approver dashboard at `/dashboard/approvals`: every Pending response across
  every form the caller can decide on, with the submitted answers, an
  optional comment, and Approve/Reject
- Dashboard and responses table both surface status (a "N pending" badge on
  form cards, a Status column in the responses table)
- 12 new API tests (31 total) covering opt-in validation, status assignment,
  decision authorization (approver/owner/no-access/wrong-role), double-decision
  rejection, and the pending-approvals aggregation
- Seed data: `colleague@smartformbuilder.dev` now holds both Editor and
  Approver roles in Operations (demonstrating multi-role-per-department); the
  seeded "Contact Us" form requires approval

**Deferred, not built:** multi-level/sequential approval chains, and real
email notifications (approver on new item, submitter on decision) — there's
no SMTP integration anywhere yet, and standing one up is its own task better
suited to when Phase 6 adds email templates. The in-app Approvals dashboard
covers the practical "what's waiting on me" need in the meantime.

### Phase 4a — Remaining field types & product code ✅ done

- 9 new field types: **Address** (composite street/city/state/zip/country,
  JSON-backed), **Rating** (configurable max, star buttons), **Signature**
  (canvas-based capture, mouse+touch, PNG data URL via
  `apps/web/src/components/SignaturePad.tsx`), **Divider**, **Heading**,
  **HTML Block** (DOMPurify-sanitized at render), **Hidden** (default value,
  pre-filled silently, excluded from required-validation), **Rich Text**
  (safe-markdown subset: bold/italic/http(s)-links), **Calculation**
  (formula referencing other Number fields by `{fieldId}` token, hand-rolled
  safe arithmetic evaluator, live-recomputed in the preview/public form)
- File/Image Upload and Payment still wait for Phase 6's storage/
  payment-provider work; Linked/Lookup and Multilingual forms remain deferred
  below pending spec clarification
- **Product code naming** (SOW 2.7): a `Form.productCode` field, editable
  from the builder, shown as a badge on dashboard form cards
- Per-type builder settings panel (`FieldSettingsPanel.tsx`): hides
  irrelevant controls per type (e.g. no Required checkbox on layout/computed
  fields), adds type-specific config UI (max rating, formula + insertable
  field-token picker + decimal places, HTML/markdown content textareas)
- `isLayoutField()`/`isComputedField()` helpers in `packages/shared` used
  consistently to skip required-field validation (client and server) for
  Divider/Heading/HTML Block/Rich Text/Calculation
- `displayAnswerValue.ts` updated for Address (flattened, comma-joined) and
  Signature ("(signed)" placeholder instead of a raw data URL) in the
  responses table; CSV export keeps raw/stable values (full JSON, full data
  URL) per the established convention
- 11 new Vitest unit tests (`apps/web`) for the safe formula evaluator and
  safe-markdown renderer, including explicit code-injection-attempt and
  XSS-payload test cases proving neither can execute
- Verified end-to-end: an 11-field test form built, published, and submitted
  via the public API with real values for every fillable field; confirmed in
  the browser that the HTML Block's embedded `<script>`/`onerror` payload is
  stripped from the actual rendered DOM while its safe markup survives, the
  Rich Text markdown renders correctly, the responses table and CSV export
  both display every new field type correctly, then cleaned up the test form

### Phase 4b — Multi-page forms & conditional logic ✅ done

- **PAGE_BREAK field type**, not a separate `Page` model: it's a layout field
  (like Divider/Heading) that marks where one page ends and the next begins,
  reusing the existing field-ordering/config machinery instead of introducing
  a second way to represent form structure. Its `label` doubles as an
  optional title for the page that follows
- `apps/web/src/lib/formPages.ts` (`splitIntoPages`): splits the flat field
  list into pages at each PAGE_BREAK. A form with none renders exactly as it
  did before multi-page support existed — zero migration burden on existing
  forms (verified against the seeded "Contact Us" form)
- `PreviewForm.tsx` renders one page at a time with a progress bar ("Page X
  of Y" + the upcoming page's title), Back/Next/Submit controls, and
  per-page required-field validation — Enter/submit on a non-final page
  advances instead of submitting, matching the Typeform/Jotform-style flow
- **Conditional field logic** (SOW 2.2/2.3): a field's `config.conditions`
  (a `{ fieldId, operator, value }` list — `equals` / `not_equals` /
  `contains`, ANY-fields-must-all-match for this pass) controls whether it's
  shown at all. `isFieldVisible()` in `packages/shared` is the single
  implementation both the client (what to render) and the server (what's
  actually required) evaluate against the same submitted answers, so the two
  can never disagree about what the visitor saw
- Server-side required-validation in `public.routes.ts` now skips any field
  a condition hid — verified directly against the public submission
  endpoint: a required field made invisible by its condition is correctly
  exempted, and a required field a condition *does* show is still enforced
  (both the positive and negative case were tested, not just the happy path)
- Builder UI (`FieldSettingsPanel.tsx`): a "Only show when a condition is
  met" checkbox reveals a trigger-field picker (restricted to earlier,
  value-bearing fields — a field can't depend on an answer the visitor
  hasn't given yet), an operator picker, and a value input that becomes a
  dropdown of the trigger field's own options when it has any (Dropdown/
  Radio/Checkbox), else free text
- Verified end-to-end: a 3-page test form (page break → conditional Email/
  Phone fields keyed off a "Preferred Contact Method" dropdown → final
  notes page) built via the API, walked through in the browser confirming
  the progress bar, page titles, Back preserving entered values, and the
  conditional field swap; submitted publicly in both branches; confirmed
  the responses table, CSV export, and the builder's settings panel all
  round-trip the stored condition correctly; cleaned up afterward

### Phase 4 continuation — Builder power features ⬜ not started

- **Linked/Lookup field** (SOW 2.2 "Database Linked form"): import a
  reference list (Excel/CSV) as a data source; bind a field to it with
  prefix-based autocomplete. Needs a clarified functional spec before
  estimating — open questions: is the dataset reusable across forms or
  scoped to one field, who can edit it, what happens with ambiguous prefixes
- Nested sections within a page
- Undo/redo, multi-select, copy/paste, custom validation rules
- **Builder UX polish** (from Jotform's open-source `dnd-builder` library):
  field resizing, alignment guides, and distinct builder/preview/presentation/
  print view modes
- **One-question-per-page "conversational" layout**: a form display mode
  variant on top of multi-page forms, one field per screen
- **Answer piping**: reuse an earlier answer's value inside a later
  question's label/help text
- **URL query-param pre-fill**: pre-populate field values from the public
  form link's query string
- **Save-and-resume**: a partially-completed public submission can be saved
  and continued later via a resume link/token
- **Multilingual forms**: translate a form's labels/text for multiple
  locales — real i18n infrastructure, needs its own scoping pass before
  estimating (translation storage model, locale switcher UX, whether
  submissions record which locale was used)

(The builder UX polish and the four items below it — one-question-per-page,
answer piping, URL pre-fill, save-and-resume — are sourced from a
competitive review of Jotform's public features page and their open-source
`dnd-builder` library — not from their closed-source product code, which
isn't public. Deliberately not chasing from that same review: 200+ native
integrations — our Phase 8 webhooks/API let users wire up Zapier/Make
themselves instead — HIPAA compliance, and offline mobile collection; all
disproportionate effort for now.)

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
- **White-labeling**: remove the "Built with Smart Form Builder" public-form
  footer, custom domain support (from the Jotform competitive review)

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
