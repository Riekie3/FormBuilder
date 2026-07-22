# Smart Form Builder

An original, Jotform-inspired online form builder: drag-and-drop form design, a
public form renderer, response collection with CSV export, and JWT auth — built
as a TypeScript monorepo (Next.js + Express + Prisma/PostgreSQL).

This is **Phase 1** of the project: a real, fully working foundation covering
core form building and submission. See [Roadmap](#roadmap) for what's
intentionally deferred to later phases.

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

Visit `http://localhost:3000`. Seeded demo login: `demo@smartformbuilder.dev` /
`Demo1234!` (also seeds one published "Contact Us" form and a "Contact Form"
template).

## Tests

```bash
# with the local/dev database running (npm run db:local, or docker compose up postgres)
npm run test:api
```

Covers the auth flow (register/login/refresh rotation/me), form CRUD,
ownership isolation, bulk field save with id-preserving upserts, publish/public
visibility, and the public submission → response → CSV export path.

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

Phase 1 ships 9 core field types (Text, Paragraph, Email, Number, Phone, Date,
Dropdown, Radio, Checkbox) and single-page forms. Deliberately deferred to
follow-up passes:

- Remaining field types: Address, Rating, Signature, File/Image Upload, Rich
  Text, Divider, Heading, HTML Block, Payment, Hidden, Calculation
- Multi-page forms, progress bar, nested sections, conditional logic,
  undo/redo, multi-select, copy/paste
- Theme system, Custom CSS/JS, password-protected forms, submission
  limits/schedule, redirect URL, autoresponder emails, spam protection,
  reCAPTCHA/Turnstile
- Analytics charts, conversion rate, completion time, Excel/PDF export, print
- Templates gallery (beyond the one seeded), QR codes, iframe/popup/WordPress
  embeds, public API keys, webhooks
- Full admin panel (users, plans, billing, logs, roles/permissions, API keys)
- S3-compatible file storage (needed once upload fields exist)
- OAuth login, 2FA, OpenAPI/Swagger docs
