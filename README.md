# WorldForge

**Your universe. Every detail connected.**

WorldForge is a worldbuilding workstation for novelists, game designers and game masters. Characters, factions, places, artifacts, history and lore live in one connected model. You can explore that model as a relationship graph, a zoomable timeline and an interactive atlas. The **Living World Engine** shows what changes when history takes another path, and nothing touches your canon until you approve it.

It ships with **The Ashen Crown**, an original sample universe. It has 17 characters, 6 factions, 12 locations, artifacts, a magic system and a faith. Its history covers 25 events with causal links, 7 lore documents, a political map and an alternate timeline called *The Red Thaw*.

---

## Contents

- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Database, migrations and seed data](#database-migrations-and-seed-data)
- [Testing](#testing)
- [Architecture](#architecture)
- [The Living World Engine](#the-living-world-engine)
- [Security model](#security-model)
- [Export and import format](#export-and-import-format)
- [Deployment](#deployment)
- [Project status](#project-status)

---

## Quick start

Requirements: Node.js 22+, PostgreSQL 15+ (or Docker).

```bash
# 1. Install dependencies (also generates the Prisma client)
npm install

# 2. Configure the environment
cp .env.example .env            # defaults work with the docker compose database

# 3. Start PostgreSQL (skip if you already have one)
docker compose up -d db

# 4. Create the schema and load the sample universe
npm run db:deploy
npm run db:seed

# 5. Run the app
npm run dev                     # http://localhost:3000
```

Sign in with the demo account **`demo@worldforge.dev` / `worldforge-demo`**, or create your own account.

To run the whole stack in containers (database, migrations, seed and app):

```bash
docker compose up --build       # http://localhost:3000
```

### Useful scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint (Next.js, React Compiler and accessibility rules) |
| `npm run typecheck` | Generates route types, then runs `tsc --noEmit` (strict) |
| `npm test` | Unit tests (pure domain logic, no database) |
| `npm run test:integration` | Service-level tests against `DATABASE_URL_TEST` |
| `npm run test:all` | Unit and integration tests |
| `npm run test:e2e` | Playwright end-to-end journey |
| `npm run db:migrate` | Create or apply migrations in development (`prisma migrate dev`) |
| `npm run db:deploy` | Apply migrations (`prisma migrate deploy`) |
| `npm run db:seed` | Load the demo account and sample universe (idempotent) |
| `npm run db:reset` | Drop, re-migrate and re-seed the development database |
| `npm run db:test:prepare` | Apply migrations to the test database |
| `npm run art` | Regenerate the bundled SVG artwork in `public/` |

---

## Environment variables

Every variable is documented in [`.env.example`](.env.example). Only `DATABASE_URL` is required.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `DATABASE_URL_TEST` | for integration tests | A **separate, disposable** database. The tests create and delete data in it. |
| `APP_URL` | recommended | Public base URL, used in invitation links |
| `AI_PROVIDER` | no | `none` (default), `demo`, `anthropic` or `openai-compatible` |
| `AI_MODEL` | with a real provider | Model ID to call. Nothing is hard-coded. |
| `AI_API_KEY` | with a real provider | Server-side only and never sent to the browser |
| `AI_BASE_URL` | no | Base URL for OpenAI-compatible APIs (defaults to OpenAI's) |
| `AI_TIMEOUT_MS`, `AI_MAX_RETRIES`, `AI_MAX_OUTPUT_TOKENS`, `AI_DAILY_TOKEN_LIMIT`, `AI_MAX_CONTEXT_CHARS` | no | AI guard rails |
| `STORAGE_DRIVER` | no | `local` (default, files under `STORAGE_LOCAL_DIR`) or `s3` |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE` | with `s3` | Any S3-compatible store: AWS S3, Cloudflare R2, MinIO and others |
| `MAX_UPLOAD_MB` | no | Upload size limit (default 10) |

**AI is optional.** With no AI configured, every AI surface shows a clear "unavailable" state and everything else works. `AI_PROVIDER=demo` returns deterministic, clearly-labelled sample output without any network calls, which is useful for demos and tests.

---

## Database, migrations and seed data

- The schema lives in [`prisma/schema.prisma`](prisma/schema.prisma) (Prisma 7, `prisma-client` generator).
  - The client is generated into `src/generated/prisma`, which is git-ignored.
  - Access goes through the `@prisma/adapter-pg` driver adapter.
- Migrations are in [`prisma/migrations`](prisma/migrations). Use `npm run db:migrate` while changing the schema, and `npm run db:deploy` in CI and production.
- [`prisma/seed.ts`](prisma/seed.ts) is deterministic and idempotent. It creates the demo account and one copy of the sample universe.
- The same sample can be added from the dashboard ("Add The Ashen Crown sample"), or chosen as a starter template when you create a universe.

---

## Testing

All test suites run without paid API calls.

```bash
npm test                         # unit tests
npm run db:test:prepare          # once: migrate the test database
npm run test:integration         # integration tests (needs DATABASE_URL_TEST)
npm run test:e2e                 # Playwright (starts `npm run dev` unless E2E_BASE_URL is set)
```

### Unit tests (`tests/unit`)

These cover:

- Chronology: ordering, precision and calendar formatting.
- Event and relationship validation.
- Graph traversal and cycle detection.
- Timeline branch inheritance and overlay resolution.
- Consistency rules.
- Impact analysis: determinism, bounds and propagation.
- Permissions, input schemas and AI configuration with demo fixtures.
- Export-format validation and ID re-keying.
- Upload type sniffing.

### Integration tests (`tests/integration`)

These run against a real PostgreSQL database and cover:

- Ownership and role enforcement.
- Entity, event, relationship and lore persistence.
- Revision restore and optimistic-concurrency conflicts.
- Proposal analysis, accept and reject, and atomic commit to a branch with canon left unchanged.
- Stale-analysis rejection and undo.
- AI suggestions with the demo provider, which never touch canon.
- Export → import round trip, and rejection of corrupted files.

The suite is skipped unless `DATABASE_URL_TEST` is set.

### End-to-end tests (`tests/e2e`)

The end-to-end suite follows the core journey:

1. Sign in.
2. Create a universe.
3. Create two characters and a faction, and connect a character to the faction.
4. Record an event with a participant.
5. Verify the nodes and edges in the graph.
6. Verify the event on the timeline.
7. Propose a date change, inspect the impact report and accept the change.
8. Commit it to a new branch and confirm the change persists.
9. Confirm canon is unchanged while the branch shows the new date.

It also covers concurrent-edit conflicts, signed-out and non-member access, invalid IDs, empty states and a failed write.

Each run signs up fresh users with unique emails against the configured database. To test an already-running server, for example a production build:

```bash
npm run build && npx next start -p 3100 &
E2E_BASE_URL=http://localhost:3100 npm run test:e2e
```

---

## Architecture

```
src/
  domain/            Pure, framework-free logic (unit-tested; no I/O)
    chronology.ts      calendar model, ordinals (year·1000 + month·40 + day), formatting
    schemas.ts         Zod schemas shared by server (authoritative) and forms (UX)
    world.ts           WorldSnapshot / WorldIndex: the serialisable world model
    timeline-resolution.ts  branch inheritance + overlay resolution
    consistency.ts     configurable contradiction rules
    impact.ts          the Living World Engine's deterministic impact analysis
    graph.ts           bounded BFS, cycle detection, shortest paths
    permissions.ts     role → capability matrix
    transfer.ts        export format: schema, validation, ID re-keying, CSV
  server/
    auth/              DB-backed sessions (hashed tokens), scrypt passwords
    services/          All database access + authorization (one module per aggregate)
    actions/           Server Actions: thin wrappers returning typed ActionResult
    ai/                Provider-independent AI layer (Anthropic, OpenAI-compatible, demo)
    storage/           Local / S3-compatible file storage with content sniffing
  app/                 Next.js App Router routes (marketing, auth, app, API)
  components/          UI (design-system primitives in components/ui)
  sample/              The Ashen Crown, plus a transactional instantiator
```

### Principles

- **Layering.** Pages and components never touch the database. Services own data access and authorization. Domain modules are pure functions over plain data.
- **Authorization.** Every protected operation calls `requireAccess(user, universe, capability)` on the server. Non-members get *not found*, so a universe's existence is never revealed. Client checks are only cosmetic.
- **Validation.** Zod schemas validate every input on the server and are reused for client-side form feedback.
- **Concurrency.**
  - Records carry a `version` column. Saves use compare-and-swap, so a concurrent edit is reported as a conflict instead of being silently overwritten.
  - Timelines carry a version, so an impact analysis made stale by later edits cannot be committed.
- **History.** Every edit writes a `Revision` snapshot, and any revision can be restored. Universe activity and an audit log record significant actions.

### Stack

- Next.js 16 (App Router, Server Actions, `proxy.ts`), React 19, strict TypeScript.
- Tailwind CSS 4 and Radix primitives (shadcn-style), Lucide icons, Motion.
- React Flow for the relationship graph. The timeline and atlas are custom canvases. An experimental 3D globe uses React Three Fiber and is lazy-loaded.
- React Hook Form with Zod.
- PostgreSQL with Prisma 7.
- Vitest and Playwright.

---

## The Living World Engine

1. **Propose.** Pick an event and change its date, location, details, or cancel it outright.
2. **Analyse.** This step is deterministic and bounded, so the same world and change always produce the same report. The engine:
   - Applies the change to a hypothetical copy of the world.
   - Follows causal dependencies breadth-first, with depth and node limits.
   - Applies lifespan rules (for example, a victim's date of death moves with their murder).
   - Traces relationships the event created or ended, participants, geography and linked lore.
   - Runs the full consistency rule set before and after the change to report contradictions the change introduces or resolves.
3. **Review.**
   - Every item shows its basis (the rule that produced it), the records it affects and its evidence, with a qualitative strength label: *Direct*, *Likely*, *Possible* or *Question*.
   - There are no invented confidence percentages.
   - AI possibilities, when enabled, are kept separate from deterministic results. Their record IDs are validated against the database.
   - You can accept, reject or edit each suggested change.
4. **Commit.** The commit is atomic and is applied either to the current timeline or to a new alternate timeline.
   - **Alternate timelines never modify their parent.** A branch stores only overlay changes, and records are inherited through the ancestor chain.
   - Every change is logged. It can be undone individually, or the timeline can be restored to any earlier point.
   - A change can be promoted to the parent timeline only through an explicit action.

---

## Security model

- **Sessions.** Sessions are stored in the database. The cookie (`wf_session`) is httpOnly, SameSite=Lax and Secure in production. It holds a random token, and only its SHA-256 hash is stored. Sessions slide on use, password resets revoke all of them, and you can sign out other devices from account settings.
- **Passwords.** Passwords are hashed with scrypt. Comparisons run in constant time, and timing is equalised for unknown emails.
- **Rate limits.** Sign-in, sign-up, password reset, uploads, imports, exports and AI calls are rate-limited (in-memory; see status).
- **CSRF.** Server Actions use Next.js's built-in origin checks. Route handlers that change data verify the `Origin` header.
- **Uploads.**
  - The file type is detected from its contents, never from the client's claim.
  - SVG, HTML and XML are refused.
  - Files are served from an authenticated route with `nosniff` and a sandboxing CSP. S3 files are served through short-lived signed URLs.
- **Security headers.** `X-Frame-Options`, `frame-ancestors 'none'`, `Referrer-Policy` and `Permissions-Policy` are set.
- **Secrets.** AI keys are read only on the server, and the client-safe status never includes them.

---

## Export and import format

You can export from **Universe settings → Export** (owners and editors):

- **Zip bundle**:
  - `universe.json`, the complete, re-importable universe in format `worldforge.universe`, version 1, including alternate timelines and their overlays.
  - `lore/*.md` with front matter.
  - `characters/*.md` character sheets.
  - `timeline.csv` and `timeline.json` (canon events in order).
  - `relationships.csv`.
  - `assets/manifest.json`.
- **`universe.json` only.**

Exports do not include revision history, proposals, AI suggestions, activity, members, or the binary contents of uploaded files. The manifest lists the files so they can be re-uploaded.

You can import from **Dashboard → Import** using a `.zip` or `.json` file. The import:

- Validates the format and version, the structure, duplicate IDs, duplicate slugs, every cross-reference, main-timeline rules and branch cycles.
- Writes nothing unless every check passes, and returns a path-by-path error report when the file is rejected.
- Re-keys every ID on import, so the same file can be imported any number of times. Each import becomes a new universe owned by the importer.

---

## Deployment

WorldForge is a standard Next.js server application.

- **Docker.** The [`Dockerfile`](Dockerfile) builds a minimal standalone image (target `runner`) and a `tools` image that runs migrations and seeding. [`docker-compose.yml`](docker-compose.yml) wires PostgreSQL, a one-shot `migrate` service and the app together.
- **Vercel or another Node host.**
  1. Set `DATABASE_URL` and `APP_URL`.
  2. Run `npm run db:deploy` as a release step.
  3. Set `STORAGE_DRIVER=s3`, because serverless filesystems are ephemeral.
  4. Optionally configure AI.
  - The build command is `npm run build`.
- **Uploads on a single host.** With local storage, persist `STORAGE_LOCAL_DIR` (it is a volume in the compose file).

---

## Project status

### Complete and verified

These were verified by tests and by browser checks against both the dev server and a production build:

- **Accounts and access.**
  - Accounts: sign up, sign in, sign out, password reset and password change.
  - Profile, plus preferences for reduced motion and the default directory layout.
  - Universe roles (owner, editor, viewer) with invitation links, role changes, removal and ownership transfer.
- **Universe setup.** A 5-step creation wizard (blank, template or AI outline) and a dashboard with real counts, activity and consistency status.
- **Records.**
  - Characters, factions, locations, artifacts and custom entity types, with type-specific attributes and revision history and restore.
  - Events with participants, precision-aware dates, custom calendars and eras, and causal dependencies with cycle prevention.
  - Lore Codex: Markdown editor with autosave, conflict detection, links and revisions.
- **Visual workspaces.**
  - Relationship graph: filters, focus, depth, shortest path, inline connection creation and saved layouts.
  - Chronos timeline: zoom across eras down to days, filters, timeline switching and branching from an event.
  - Atlas: placement, routes, regions and layers, plus the experimental globe.
- **Living World Engine.** The full propose → analyse → review → commit flow; alternate timelines with comparison, undo, restore and promotion.
- **Search, settings and data.**
  - Global search and a command palette (⌘K / Ctrl+K).
  - Asset library: upload, replace, link to records and set portraits.
  - Universe settings: details, calendar, consistency rules, AI switch, custom relationship types, members, export, archive and delete.
  - Export and import with validation reports.
- **Marketing site.** Real product previews computed by the engine. Legal pages are clearly marked as drafts.

### Known limitations and incomplete

- **Rate limiting** is in-memory and per process. Use a shared store such as Redis when running more than one instance.
- **Email delivery** is not implemented. Invitations produce a copyable link. In development, the password-reset link is shown on screen; in production a mail provider must be added before the reset flow is usable.
- **AI.**
  - Responses are schema-validated and stored as pending suggestions.
  - Provider refusals and safety stop reasons are surfaced only as generic generation errors. There is no dedicated fallback handling.
  - Only the demo provider is exercised by tests. The Anthropic and OpenAI-compatible adapters have not been run against live APIs in this repository.
- **Real-time collaboration** (presence, live cursors) is not implemented. Concurrent edits are protected by optimistic locking instead.
- **The atlas** uses an image-based coordinate system. A MapLibre or tiled-map mode is not included. The 3D globe is experimental.
- **Exports** do not include uploaded file contents, revision history or proposals.
- **The Docker image** builds from the provided Dockerfile. The compose stack's migrate-then-serve sequence is documented, but it is not part of the automated test suite.
