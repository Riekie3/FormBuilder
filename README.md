# Smart Form Builder

An original, Jotform-inspired online form builder: drag-and-drop form design, a
public form renderer, response collection with CSV export, and JWT auth — built
as a TypeScript monorepo (Next.js + Express + Prisma/PostgreSQL).

This is **Phases 1-3 plus Phase 4a-4o of 8** on the roadmap: core form
building/submission, department-based roles and permissions, a
single-level approval workflow, 13 additional field types (Address, Rating,
Signature, Divider, Heading, HTML Block, Hidden, Rich Text, Calculation,
Matrix, Line Items, Section, Lookup) plus product code naming, multi-page
forms with conditional field logic (now group-level via Sections, not just
per-field), builder undo/redo/multi-select/copy-paste, answer piping with
URL query-param pre-fill, save-and-resume, custom field validation rules, a
one-question-per-page conversational layout, half/third-width fields for
side-by-side layouts, a printable fill-by-hand view of a form, one-click
form duplication, portable JSON export/import of a form's design, and a
Lookup field with per-form, autocomplete-backed reference lists. See
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
enforcement, create-permission checks), the approval workflow (opt-in
validation, submission status, decision authorization, the pending-approvals
aggregation), save-and-resume drafts (save/update-in-place/fetch,
cross-form token isolation, cleanup on final submit), field-level
validation rules (Number min/max, Text length/format, Email format, and
that an optional field left blank skips format checks while one that's
merely non-required-but-filled-in still gets validated), the Repeater
field's required-at-zero-rows behavior, Section-level conditional
visibility (a hidden section exempts its fields from required-validation,
a visible one still enforces them, and a section's scope correctly stops
at a Page Break), form duplication (field/settings fidelity, that
responses are never copied, and the department/approval carry-over
permission boundary), portable export/import (the export shape omits
instance-specific data, a round-trip preserves field fidelity, and
malformed import files are rejected), and Lookup field reference lists
(dataset round-tripping, required-validation treating it like Text while
still accepting off-list values, and datasets carrying through
duplicate/export/import). The auth/submission
rate limiters are skipped under `NODE_ENV=test` so test suites that
legitimately register many accounts don't throttle themselves.

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
  payment-provider work; the Linked/Lookup field shipped later, in Phase 4o
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

### Phase 4c — Builder undo/redo, multi-select & copy/paste ✅ done

Pure builder-UX additions — no schema or API changes, since none of this
touches what a form *is*, only how it's edited.

- **Undo/redo**: `useFormBuilder` keeps a `{ past, future }` history stack
  (capped at 50 entries) of field-array snapshots. Every discrete mutation
  (add/update/remove/duplicate/paste, single or bulk) pushes the pre-change
  snapshot before applying itself. A drag-to-reorder gesture calls `onMove`
  once per hover frame, so history is captured once per *gesture* instead —
  a snapshot taken when the drag starts, committed only if the order
  actually changed by the time it ends — otherwise undo would only step
  back one pixel of mouse movement at a time
  - Ctrl/Cmd+Z to undo, Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y to redo, plus header
    toolbar buttons with correct disabled states
- **Multi-select**: Ctrl/Cmd-click toggles a field in/out of selection,
  Shift-click selects a contiguous range, a plain click selects just one,
  and clicking empty canvas space clears the selection. Selecting more than
  one field swaps the settings panel for a bulk actions bar (Duplicate/
  Delete all selected)
- **Copy/paste**: Ctrl/Cmd+C copies the current selection into an in-memory
  clipboard (not the OS clipboard — this is same-session, same-builder
  only, which is the only case that matters here), Ctrl/Cmd+V pastes fresh
  copies right after the current selection. Both shortcuts — along with
  undo/redo — are guarded against any focused text input, textarea, select,
  or contenteditable element, so they never hijack normal text editing in
  the label/placeholder fields or the form title
- **A real bug found and fixed during verification, not just a hypothetical
  edge case**: newly-added fields get a temporary client-side id until the
  debounced autosave round-trip assigns a real one. `selectedIds` — and,
  since Phase 4a, Calculation formula tokens and condition `fieldId`s — can
  reference a field by that temporary id. Left un-remapped, a field selected
  right before its id got reconciled would silently stop matching anything,
  so a bulk-delete right after a bulk-duplicate could appear to succeed
  (selection clears) while deleting nothing. Fixed by remapping temp→real
  ids across `selectedIds` and every history snapshot in the same place the
  reconciliation already happens. Verified directly: reproduced the exact
  race (duplicate → wait for autosave → bulk-delete) before and after the
  fix, confirmed the deletion now actually persists
- Verified in the browser: undo/redo round-tripping add/duplicate/delete,
  the id-reconciliation race above, multi-select via ctrl-click, bulk
  duplicate/delete, and Ctrl+C/Ctrl+V pasting a field. **Not verified**:
  drag-to-reorder's history capture specifically — this sandbox's browser
  pane can't composite frames for coordinate-based drag simulation, and
  react-dnd's HTML5 backend doesn't respond to synthetically-dispatched
  drag events either, so that one path is reviewed-correct rather than
  browser-confirmed. The reorder mechanism itself is untouched pre-existing
  code; only the history bookkeeping around it is new.

### Phase 4d — Matrix field ✅ done

A ratings-grid field type — one row per item, one set of columns as the
shared answer scale (e.g. Poor/Fair/Good across the top, one row per
feature being rated). This is what Jotform calls a "Matrix" field, and it's
the most common thing people mean by "table" in a form builder — distinct
from a repeatable/variable-row line-items table, which is a bigger,
not-yet-built feature (new answer-storage shape, add/remove-row UI, CSV
export changes) noted below in the continuation list.

- `FieldConfig.matrixRows` / `matrixColumns` (both reuse the existing
  `FieldOption` shape): rows define what's being rated, columns define the
  shared answer scale
- One answer per row, stored as a single JSON string keyed by row id —
  `{ [rowId]: columnValue }` — following the same "composite value as JSON"
  convention as the Address field, so no `Answer` schema change was needed
- **Required means every row answered**, not just "the field has some
  value" — a visitor who rated 2 of 5 rows hasn't really answered it. This
  needed a real shared helper (`isFieldAnswerComplete()` in
  `packages/shared`) rather than the simple non-empty-string check every
  other type used, since "is this answer complete" is now type-dependent.
  Used identically by the client (`PreviewForm.validate()`) and the server
  (`public.routes.ts`), so the two can't disagree about what counts as answered
- Builder settings panel gets add/remove editors for both rows and columns,
  mirroring the existing Options editor pattern used by Dropdown/Radio/Checkbox
- Not offered as a conditional-logic trigger field — its answer is a JSON
  blob, and exposing that for `equals`/`contains` comparison without a
  dedicated per-row selector would be more confusing than useful
- Responses table and CSV export follow the established convention: the
  table shows `Row label: Column label` pairs, CSV export keeps the raw
  JSON (keyed by row id, not row label, so it stays stable if a row is
  ever relabeled)
- Verified end-to-end: built a Matrix field in the browser (3 rows × 3
  columns, one row renamed, marked required), confirmed the client blocks
  submission with 2 of 3 rows answered and accepts it with all 3; separately
  confirmed the server rejects the same incomplete answer directly against
  the public API (bypassing the client entirely); confirmed the responses
  table renders it as readable `label: label` pairs and CSV export keeps
  the raw row-id-keyed JSON

### Phase 4e — Answer piping & URL pre-fill ✅ done

Two small, client-side-only additions — neither needed a database
migration, and both are about pulling data from *outside* the field being
rendered into what the visitor sees.

- **Answer piping**: a `{fieldId}` token in a field's label, help text, HTML
  Block content, or Rich Text content is substituted with that field's
  current answer, live, as the visitor fills the form — e.g. a label reading
  "Thanks, {name}! What's your favorite color?" updates on every keystroke
  in the name field. An unanswered token pipes in as an empty string, the
  same "sensible empty default" convention the Calculation field already
  established. `apps/web/src/lib/answerPiping.ts` (`pipeAnswers()`) is the
  entire implementation — a single regex substitution, web-only, since
  nothing server-side ever renders a label
- Builder UI: a small "Pipe in an earlier answer" row of insert buttons
  appears under Label, Help Text, HTML content, and Rich Text content,
  listing the same "earlier, value-bearing fields" candidate set already
  computed for conditional logic — reused as-is rather than duplicated
- **URL query-param pre-fill**: a field can be given a `config.prefillKey`
  (e.g. `ref`) so visiting `/f/slug?ref=newsletter` seeds that field's
  initial answer before the visitor types anything. Implemented entirely in
  `PublicFormClient.tsx` via `useSearchParams()` matching each field's
  configured key against the query string — the public page's dynamic
  Server Component was already `cache: "no-store"`, so the required
  `<Suspense>` boundary around the client component was the only
  structural change needed, verified against a real `next build` (not just
  dev mode, which won't catch a missing Suspense boundary the way a
  production build does)
- Pre-filled values are ordinary answers as far as required-field
  validation is concerned — no special-casing needed, since they just seed
  the same `values` state a typed answer would land in
- Not offered on fields whose answer isn't a plain string (Address, Matrix,
  Signature) for the same reason those are excluded from conditional-logic
  triggers — a raw JSON blob isn't practical to pass as a single query value
- Verified end-to-end: built a two-field form (a prefill-keyed "Your Name"
  field, and a second field piping that name into both its label and help
  text), confirmed `?name=Alex` pre-filled the input *and* rendered "Alex"
  in the piped label/help text on load, confirmed piping stayed live when
  the visitor edited the name afterward, confirmed the no-query-param case
  degrades to empty tokens rather than showing `{fieldId}` literally, and
  confirmed both builder-side controls (the token-insert buttons and the
  URL-parameter-name input) round-trip correctly

### Phase 4f — Save-and-resume ✅ done

A visitor can save a partially-completed public submission and pick it back
up later from a link, without ever creating a half-finished `Response`.

- New `DraftResponse` model — deliberately separate from `Response`/`Answer`
  rather than an "incomplete" response, so a draft never appears in the
  responses table, never counts toward `responseCount`, and never needs an
  approval status. Its `answers` column is a single JSON blob (`{ [fieldId]:
  value }`), not normalized `Answer` rows, since a draft is transient
  scratch state, not the durable per-field record a real submission is
- The token is the entire access control, same trust model as the public
  submission endpoint itself: unauthenticated, unguessable (`cuid`). There
  is no cleanup job yet — abandoned drafts persist indefinitely, a
  documented, deliberate limitation rather than an oversight
- `POST /forms/:slug/draft` creates a draft (no token in the request) or
  updates one in place (token supplied) — a visitor clicking "Save and
  finish later" repeatedly updates the same row instead of accumulating one
  per click. `GET /forms/:slug/draft/:token` fetches it back for resuming.
  The real submission endpoint accepts an optional `resumeToken` and
  deletes the matching draft once the submission succeeds
- `PublicFormClient.tsx` reads `?resume=token` from the URL, fetches the
  draft, and merges its answers into `PreviewForm`'s `initialValues` —
  taking priority over any `prefillKey` URL pre-fill, since a resumed
  visitor's actual saved progress should win over generic pre-fill hints.
  A resumed draft's answers are ordinary answers as far as required-field
  validation and later re-saves are concerned, no special-casing needed
- An invalid or expired resume token degrades to "That saved link couldn't
  be found — starting fresh" rather than a broken page
- 6 new API tests: save/fetch round-trip, update-in-place instead of
  duplicating, 404 on a missing or cross-form token, draft deletion on
  final submit, an unrelated draft surviving a submission that didn't
  reference it, and 404 for both draft endpoints on an unpublished form
- Verified end-to-end in the browser on a real 2-page form: filled page 1,
  saved a draft mid-fill, copied the resulting resume link, loaded it in a
  fresh navigation and confirmed the saved answer restored into the input
  (not just displayed — read the DOM value directly), completed page 2 and
  submitted, then confirmed both that the response recorded correctly and
  that the draft was actually deleted server-side afterward; separately
  confirmed the invalid-token fallback path

### Phase 4g — Custom field validation rules ✅ done

Closes a real, pre-existing gap: the `NUMBER` field's `min`/`max` config
has existed since Phase 1 but had **zero builder UI to set it and zero
server-side enforcement** — dead, half-wired config nobody could actually
use. This phase both fixes that and extends validation to Text length and
content-shape constraints.

- `getFieldValidationError()` in `packages/shared` — the single
  implementation the client (inline error display) and server (actual
  rejection) both call, so they can't disagree about what's valid. Checked
  independently of required-ness: an optional Email field, if filled in at
  all, still has to look like an email
- `minLength`/`maxLength` (Text, Paragraph) and a `format` preset (Text
  only: Any / Letters only / Numbers only / Letters and numbers only)
- **Deliberately not a user-authored regex.** A form-builder-supplied
  pattern evaluated on every public submission is a real ReDoS
  (catastrophic-backtracking) vector — ordinary, not just malicious,
  patterns like `(a+)+` can hang a request indefinitely. The `format`
  presets are a closed set of fixed, hand-vetted, linear-time regexes,
  the same "no user-authored code" approach already used for the
  Calculation field's formula evaluator and the Rich Text renderer
- **A real bug found and fixed during verification, not a hypothetical**:
  giving the pre-existing `NUMBER` min/max config real values for the
  first time revealed that `<input type="number" min max>`'s *native*
  HTML5 constraint validation silently blocks the entire form's submit
  event — no visible error, no network request — before React's own
  `onSubmit` handler, and therefore this phase's new validation, ever
  runs. The same issue affects `type="email"`'s native format check.
  Fixed by dropping the `min`/`max` attributes (server + custom JS now
  own that check) and switching Email to `type="text"` +
  `inputMode="email"` (keeps the mobile "@"-keyboard hint, drops the
  native blocking). `maxLength` was kept as an HTML attribute since,
  unlike `minLength`, it only caps typing and has no submit-blocking
  behavior of its own
- Verified end-to-end: built a form with a letters-only length-bounded
  Text field and a bounded Number field; confirmed invalid input is
  silently swallowed by native validation *before* the fix and correctly
  shows inline errors *after* it; confirmed the server independently
  rejects the same invalid values when submitted directly against the
  public API, bypassing the browser entirely; confirmed valid submissions
  still succeed and appear in the responses table. 7 new API tests cover
  Number range, non-numeric rejection, Text length, Text format, Email
  format, and the required-vs-format-independent distinction

### Phase 4h — One-question-per-page conversational layout ✅ done

A form display mode where every real question gets its own page — the
Typeform-style "conversational" layout — built directly on top of the
Phase 4b multi-page infrastructure rather than as a separate system.

- `Form.oneQuestionPerPage` (boolean, default `false`): a per-form toggle
  in a new "Layout" settings card in the builder, alongside Product code
  and Approval workflow
- `splitIntoPages()` in `apps/web/src/lib/formPages.ts` grew a second mode
  rather than a second function: when enabled, a new page starts before
  every real question, but any layout content directly ahead of it (a
  Heading, a Rich Text blurb) rides along on the same page instead of
  getting a blank page of its own — a page showing only a heading with a
  Next button and no actual question would be poor UX. Manual `PAGE_BREAK`
  fields are simply ignored while this is on rather than double-applied
- Threaded through the same `oneQuestionPerPage` prop on `PreviewForm` in
  both the public form (`PublicFormClient`) and the builder's own live
  Preview modal, so what the builder previews always matches what a
  visitor actually sees
- Verified end-to-end: built a 3-field form (Heading + Name, Email, Age)
  with the toggle on, confirmed the public form showed exactly 3 pages
  with the Heading correctly grouped onto page 1 with Name (not a 4th,
  heading-only page), completed and submitted it successfully, and
  confirmed the builder's own Preview modal shows the identical pagination
  live, without needing to publish first. 1 new API test covers the
  default-off/toggle/public-exposure round-trip

### Phase 4i — Line Items (repeatable row table) ✅ done

A visitor-editable line-items table — Product/Qty/Price-style rows the
visitor adds and removes themselves — distinct from the Phase 4d Matrix
field's fixed grid, where rows are defined at design time, not fill time.

- Turned out **not** to need the variable-length-answer-shape schema work
  the roadmap originally assumed: `Answer.value` is already a free-form
  string column, so a JSON array of row objects fits the exact same
  "composite value as JSON" convention already used for Address and
  Matrix. No `Answer` schema change, no migration beyond the field type
  itself — the anticipated complexity didn't materialize once actually
  implemented
- `FieldConfig.repeaterColumns` (reuses `FieldOption`, like Matrix's
  rows/columns) defines the table's columns; the answer is
  `[{ [columnId]: value }, ...]`, one object per visitor-added row
- **Required means at least one row exists** — not that every cell in
  every row is filled. A visitor who added one line item has meaningfully
  answered the field even with an optional column left blank on it;
  requiring every cell of every row would be Matrix-level strictness this
  field doesn't need, since rows themselves are optional to add at all
- Not offered as a conditional-logic trigger field, same reasoning as
  Matrix: the answer is a JSON blob, not a single comparable value
- Builder settings panel gets a Columns editor (add/remove/rename),
  mirroring Matrix's column editor — no Rows editor, since rows are
  visitor-added at fill time, not defined by the form builder
- Responses table and CSV export follow the established convention: the
  table shows `Item: Widget, Quantity: 3, Price: 9.99`-style readable
  summaries (rows joined with " | "), CSV keeps the raw column-id-keyed
  JSON array
- Verified end-to-end: confirmed a required Line Items field blocks
  submission at zero rows and accepts it at one; added two rows, removed
  one, and confirmed the remaining row's data survived the removal intact
  (worth checking explicitly, since rows are addressed by array index —
  removing a row shifts every later index down, and it needed to not
  scramble the surviving data); submitted successfully and confirmed both
  the responses table and CSV export render it correctly. 3 new API tests
  cover the required-at-zero-rows/accepted-at-one-row distinction, the
  optional-field skip, and that multi-row data round-trips through
  storage unchanged

### Phase 4j — Field width (side-by-side layout) ✅ done

The first slice of "builder UX polish" — `FieldConfig.width` (`full` /
`half` / `third`) lets two half-width fields, or three third-width ones,
sit on the same row instead of every field always taking the full page
width. The classic case: First Name and Last Name side by side.

- Implemented as a 6-column CSS grid: `full` = `col-span-6`, `half` =
  `col-span-6 sm:col-span-3`, `third` = `col-span-6 sm:col-span-2`. Below
  the `sm` breakpoint every field falls back to full width regardless of
  its configured width, so a half-width field never renders cramped on a
  phone screen
- One shared `widthSpanClass()` helper (`apps/web/src/lib/fieldWidth.ts`)
  drives both the builder canvas (`Canvas.tsx`/`FieldItem.tsx`) and the
  actual field-filling UI (`PreviewForm.tsx`), so the builder's canvas
  layout and what a visitor sees never drift apart
- Not offered for Address, Matrix, Repeater (complex internal sub-layouts
  that get cramped at half/third width), Signature, Divider, or Page
  Break (structurally full-bleed by nature) — the width selector simply
  doesn't appear for those types in the settings panel
- Verified end-to-end: built a form with half-width First/Last Name
  fields and a full-width Email field, confirmed via actual computed
  `getBoundingClientRect()` layout (not just visual inspection) that the
  two half-width inputs share the same row at half the container's width
  each, in both the builder canvas and the live public form; resized to a
  mobile viewport and confirmed all three fields correctly stack to full
  width instead of staying cramped side by side; submitted the form
  successfully

### Phase 4k — Print view ✅ done

A printable, fill-by-hand rendering of a form — for handing someone a paper
copy, or a PDF made via the browser's own print dialog, when filling out
the live web form isn't an option. Scoped as builder-side tooling (like
Preview), not a public-facing feature: only the form owner/editor can open
it, from a new "Print" button in the builder toolbar.

- `apps/web/src/components/PrintFormView.tsx`: a from-scratch renderer,
  not a repurposed `FormFieldRenderer` — a printed page has no interactive
  controls at all, so every field type reduces to its paper equivalent
  instead of a disabled input. Text-like fields get a ruled blank line,
  Paragraph gets three, Dropdown/Radio get an empty circle per option to
  mark, Checkbox an empty square, Rating a row of outlined stars, Address
  five captioned blanks, Signature a signature line plus a separate date
  line, Matrix a table of empty circles, and Line Items a table with its
  configured columns and four blank rows to write into. Heading/Divider/
  HTML Block/Rich Text render as ordinary content (nothing to fill in);
  Hidden and Calculation contribute nothing to a printed page (nothing a
  visitor would write, and nothing that can be computed without the live
  form); a Page Break becomes a literal CSS `break-after: page` so a
  multi-page form paginates correctly when actually printed
- New authenticated route `/dashboard/forms/[id]/print` (own minimal
  chrome, not wrapped in the dashboard shell's nav/header, so nothing but
  the form itself is on the page) with a `print:hidden` "Print this form"
  button that calls `window.print()`
- `globals.css` forces a white background/black text under `@media print`
  regardless of the app's dark mode — a dark-mode screenshot-to-PDF would
  otherwise waste ink or print as a solid black page on most printers
- Verified end-to-end: built a test form covering every field type
  (Heading, Address, Rating, Signature, Checkbox, Radio, Calculation, Line
  Items, Page Break, alongside the pre-existing Text/Email/Phone/Dropdown/
  Paragraph "Contact Us" form), opened `/print` and confirmed every type
  renders its correct paper equivalent and that Hidden/Calculation/Page
  Break correctly contribute no visible fill-in content; confirmed via
  `getComputedStyle`/`getBoundingClientRect` (not just visual inspection)
  that the page's actual background and structure are correct; ran a full
  production build to confirm the new route compiles and is registered

### Phase 4l — Sections & group-level conditional visibility ✅ done

Nested sections within a page, reconsidered: a plain Heading already
labels a group visually, so the missing piece wasn't another content
block — it was applying **one condition to an entire group of fields**
instead of repeating the same condition on each field individually. That
turned out to be a small, schema-light addition once framed that way,
built directly on the Phase 4b conditional-logic infrastructure rather
than as a new nested-structure concept.

- **Section field type**: a title, an optional description, and the same
  `config.conditions` every other field already has. Its condition gates
  not just itself but every field that follows it, up to the next Section
  or Page Break — a form builder sets the condition once on the Section
  instead of copy-pasting it onto every field inside the group
- `computeVisibleFieldIds()` in `packages/shared`: walks the field list in
  order, tracking whether the "current section" is open, and returns the
  full set of fields actually visible to the visitor (a field's own
  condition AND its enclosing section's both have to pass). Used
  identically by the client (`PreviewForm`, replacing the old direct
  `isFieldVisible` filtering) and the server (`public.routes.ts`'s
  required-validation loop), so the two can't disagree about what the
  visitor saw — same guarantee Phase 4b's per-field conditions already had
- **Sections deliberately don't span a Page Break** — `PAGE_BREAK` always
  resets the group back open, since a Section reads as one visual screen's
  worth of grouped content, not something spanning multiple pages. A field
  right after a page break is never accidentally exempted by an unrelated,
  possibly-hidden section earlier in the form
- Rendered as a bordered, heading-like block (title + description, no
  input of its own) in the builder canvas, the live public form, and the
  print view — visually distinct from a plain Heading via a top border
  that reads as "a new group starts here"
- Not offered as a conditional-logic trigger candidate for other fields
  (it carries no value, same reasoning as Divider/Heading), always
  full-width (grouping markers don't make sense at half/third width), and
  excluded from the one-question-per-page "does this page already have
  its question" check the same way other layout content is — a lone
  Section title never becomes its own blank page
- 3 new API tests verify directly against the public submission endpoint
  (bypassing the client): a required field inside a hidden section is
  exempted, the same field is enforced when the section's condition is
  met, and a section's hidden scope correctly stops at a Page Break rather
  than leaking into unrelated fields after it
- Verified end-to-end: built a form with a Dropdown ("Are you employed?")
  gating a Section containing two required text fields; confirmed in the
  browser that choosing "No" hides the section and its fields (and any
  inline errors on them) live, choosing "Yes" reveals them and enforces
  both as required, and submitting with "No" succeeds without them —
  matching the three cases the new API tests cover independently; also
  confirmed the print view renders the section's title/description/fields
  unconditionally, as a static paper form should

### Phase 4m — One-click form duplication ✅ done

A "Duplicate" action on any form, from the dashboard's per-form menu — a
common gap in the flow so far: reusing an existing form's structure meant
rebuilding it field-by-field from scratch. Standard in every comparable
form builder (Jotform included), and fully scoped without touching
anything drag-related.

- `POST /api/forms/:id/duplicate`: clones the source form's fields
  (fresh ids, same type/label/required/order/config) and settings
  (description, product code, one-question-per-page) into a new form
  owned by the caller
- **Always lands as a Draft**, regardless of the source form's status —
  cloning a published form should never silently publish a second live
  copy of it. Its response count always starts at zero; **responses are
  never copied**, only the form's structure
- **Department and approval config only carry over if the caller can
  still create forms in that department themselves** (reusing the same
  `canCreateInDepartment` check the create/move-department endpoints
  already use) — otherwise the clone silently falls back to a private
  draft. Without this, duplicating a department form would hand the
  caller department-wide visibility they wouldn't otherwise have, just by
  cloning something they were only allowed to *view*
- **Only requires view access to the source**, not edit — duplicating
  never modifies the original, so a department member who can merely view
  a form can still use it as their own starting point
- Dashboard: the per-form actions menu (previously delete-only, and only
  shown to users who could delete) is now shown to every form the user can
  see at all, offering Duplicate always and Delete only when the user
  actually has that permission. Duplicating navigates straight into the
  new draft's builder, matching the "Create" button's existing UX
- 5 new API tests cover the clone's field/settings fidelity, that
  responses are never copied, the department/approval carry-over-or-drop
  behavior in both directions, and the view-only permission boundary
- Verified end-to-end: duplicated the seeded "Contact Us" form (published,
  5 fields including a Dropdown with options, approval-enabled in
  Operations) as its super-admin owner — confirmed the copy landed in the
  builder as a Draft with all 5 fields and the approval config intact,
  confirmed on the dashboard it shows 0 responses while the original's 1
  response and Published status were untouched; ran a clean production
  build

### Phase 4n — Portable form export/import ✅ done

A form's design (not its responses) can now be exported as a standalone
JSON file and imported back — either as a backup, or to share a form's
structure with someone else, including across accounts. Distinct from
Phase 4m's Duplicate: duplication is a same-account "copy for myself"
shortcut, while export/import produces a real portable file that can leave
the account (or the running instance) entirely and come back later.

- `GET /api/forms/:id/export`: a JSON snapshot of the form's title,
  description, product code, one-question-per-page flag, and fields —
  deliberately **excludes everything instance-specific**: id, slug,
  status, and department/approval linkage. A department or approver-role
  id from the exporting account wouldn't mean anything (or might not even
  exist) wherever the file ends up, so none of it is included at all,
  going a step further than Duplicate's "carry it over only if the
  caller can still create there" fallback
- `POST /api/forms/import`: validates the uploaded JSON against the same
  field schema the builder's own autosave already uses, then creates a
  new form from it. **Always private with no department, always a
  Draft** — there's no safe permission check to run against a department
  id that came from an arbitrary file, so import doesn't attempt one; it
  always lands somewhere private the importer fully controls
  first
- The export carries a `kind`/`version` marker so a malformed or
  unrelated JSON file gets a clear "this doesn't look like a valid Smart
  Form Builder export file" error instead of a raw validation dump —
  and leaves room for a future format migration if the shape ever changes
- Builder gets an "Export" button (next to Print) that downloads the
  form's `{slug}.json`; the dashboard gets an "Import" button that reads a
  selected `.json` file client-side and, on success, navigates straight
  into the new draft's builder — matching Create/Duplicate's existing UX
- 4 new API tests cover the export shape (instance-specific fields
  genuinely absent, not just unused), a full export → import round-trip
  preserving field fidelity, and that malformed/wrong-`kind` payloads are
  rejected with a 400
- Verified end-to-end: exported the seeded "Contact Us" form and confirmed
  the JSON response directly (no id/slug/status/department/approval keys
  present); imported a hand-built export file via a simulated file input
  and confirmed the new form landed in the builder with all fields intact
  and no department attached; confirmed a garbage JSON file surfaces the
  friendly rejection message inline on the dashboard instead of a silent
  failure; ran a clean production build

### Phase 4o — Linked/Lookup field ✅ done

Matches SOW 2.2 ("Database Linked form"). Resolved with the client: a
dataset is scoped to **one form**, reusable by any number of Lookup fields
within it (not a global, cross-form library); anyone who can already edit
the form can manage its datasets, with no separate permission concept
needed; and an unmatched entry the visitor types is still accepted — the
list is a suggestion aid, not a hard constraint. Multilingual forms
(the other item that had been sitting in this same backlog slot) is now
out of scope entirely — English-only is all that's needed.

- **Named reference lists live on the form**, not the field:
  `Form.lookupDatasets` (`[{ id, name, values: string[] }]`), so a
  "Companies" list and a "Products" list can coexist, and a "Employer"
  field and a "Referred by" field can both point at the same list without
  it being copy-pasted twice
- **Scoping call on "Excel/CSV"**: real `.xlsx` is a binary format needing
  either a parsing library or file storage, and neither exists yet (file
  storage is explicitly Phase 6). This pass supports pasting a list
  (one value per line) or uploading a plain `.csv` — parsed entirely
  client-side with a deliberately minimal, hand-rolled single-column
  reader (`apps/web/src/lib/simpleCsv.ts`, unit tested), not a general
  CSV library. True `.xlsx` upload is a natural Phase 6 follow-up
- **Autocomplete, not a locked dropdown**: as the visitor types, every
  case-insensitive substring match is suggested (a Lookup field renders as
  a text input with a suggestions list beneath it); clicking one fills it
  in, but the visitor can still type and submit something the list doesn't
  have at all — required-ness and format validation both treat it exactly
  like a Text field
- Builder UI lives inside the Lookup field's own settings panel — a
  dataset picker (pick an existing list, or create one), and when one's
  selected, its name and values become editable inline (plus a CSV-upload
  button and a delete-list button) — no separate "manage datasets" page
- **A real race condition found and fixed during verification, not a
  hypothetical**: editing a dataset's name and then immediately its values
  (both independently debounced saves) could silently clobber each other —
  each save built the *entire* datasets array from the same stale
  pre-edit prop, so whichever save actually fired last would overwrite the
  other's change. Fixed with a ref that tracks "what we've actually asked
  to save" as the baseline for every edit, reset only when the selected
  field changes (not on every incoming prop update, which would have
  reintroduced the same bug from the other direction). Reproduced the
  exact race before the fix and confirmed both edits now survive together
- Dataset creation/deletion/CSV-import go through an immediate save
  (awaited before the field's own `lookupDatasetId` is set) rather than
  the debounced path typing uses — a debounced create would leave a brief
  window where the field points at a dataset id that doesn't exist yet in
  the builder's own state
- 6 new API tests cover the dataset round-tripping through PATCH/GET, a
  field's `lookupDatasetId` round-tripping through the fields endpoint,
  required-validation treating it like Text while still accepting
  off-list values, datasets carrying through duplicate/export/import, and
  an oversized dataset list being rejected
- Verified end-to-end: created a "Companies" list with 5 entries on a
  Lookup field in the browser, confirmed typing "in" suggests both
  "Initech" and "Stark Industries", confirmed clicking a suggestion fills
  the field, confirmed a completely unlisted value still submits
  successfully both client- and server-side, and confirmed the print view
  renders it as a plain blank line (no dataset content leaks onto paper)

### Phase 4 continuation — Builder power features ⬜ not started

- **Remaining builder UX polish**: alignment guides during drag — field
  width/resizing (Phase 4j), a print view mode (Phase 4k), and the Lookup
  field (Phase 4o) are all done; alignment guides need live drag-position
  feedback, which isn't meaningfully verifiable in this sandbox's browser
  pane (react-dnd's HTML5 backend doesn't respond to synthetic drag
  events), so it's left for a session where real drag interaction can be
  tested. This is now the only item left in this backlog slot.

(The builder UX polish item above is sourced from a competitive review of
Jotform's public features page and their open-source `dnd-builder`
library — not from their closed-source product code, which isn't public.
Deliberately not chasing from that same review: 200+ native integrations
— our Phase 8 webhooks/API let users wire up Zapier/Make themselves
instead — HIPAA compliance, and offline mobile collection; all
disproportionate effort for now.)

### Phase 5 — Dashboard, Reporting & Data Lifecycle ⬜ not started

- Analytics charts: daily/monthly submissions, conversion rate, average
  completion time
- Per-column filtering, date-based filtering (SOW 2.5)
- Excel export, PDF export (SOW 2.6) — a blank-form print view already
  shipped in Phase 4k; this item is about exporting *response data*
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
