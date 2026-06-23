# SalesGenius

Multi-agent AI sales/support platform. Two independent packages, no workspace.

```
frontend/   Next.js 16.2.9 + React 19 + Tailwind CSS 4 (App Router) — :3000
backend/    Express 5 + Prisma 7 + PostgreSQL + Vercel AI SDK — :4000
```

Each has own `node_modules`, `tsconfig`, scripts. No shared code. No test runner — CI gate is `npm run build`.

## Quick-start

```bash
docker compose up -d db                            # PostgreSQL on :5432

cd backend
npm run prisma:generate                             # Prisma client (after schema changes)
npm run dev                                         # tsx watch src/main.ts — :4000

# separate terminal
cd frontend
npm run dev                                         # next dev — :3000

# seed (optional)
cd backend && npx tsx prisma/seed.runtime.mjs
```

**Startup order:** PostgreSQL → `prisma generate` → `npm run dev`

Full-stack Docker: `docker compose up` (builds both, applies schema, seeds, starts on :3000 + :4000)

## Commands

### Backend
| Command | What |
|---------|------|
| `npm run dev` | `tsx watch src/main.ts` — hot reload |
| `npm run build` | `tsc` — `src/` → `dist/` |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Run migrations |

### Frontend
| Command | What |
|---------|------|
| `npm run dev` | `next dev` |
| `npm run build` | `next build` (typechecks too) |
| `npm run lint` | ESLint (not a CI gate) |

## Architecture

### Backend (feature-based)
Each feature in `src/features/<name>/` owns `*.routes.ts` + `*.controller.ts`.

| Mount | Feature | Auth | Purpose |
|-------|---------|------|---------|
| `/api/auth/*` | `auth/` | None / JWT | Login, register (creates tenant), forgot/reset, me |
| `/api/crm/*` | `crm/` | JWT + OWNER | CRM CRUD — contacts, companies, deals, tickets, users, conversations, agent-tasks, dashboard |
| `/api/client/*` | `client/` | JWT + CLIENT | Portal: deals, tickets, interactions, profile, conversation |
| `/api/onboarding/*` | `onboarding/` | Mixed | Generate invitation link, verify, complete (creates CLIENT) |
| `/api/documents/*` | `documents/` | JWT + role | Upload (CLIENT), list/review (OWNER) |
| `/api/agent/*` | `chat/` | Mixed | Agent chat, trajectory SSE stream, interaction history |
| `/api/*` | `public/` | Mixed | Pipeline summary, contacts/agents list |
| `/api/notifications/*` | `notifications/` | JWT in query | SSE notification stream per user |

Other: `src/config/env.ts`, `src/core/{database,errors,response}.ts`, `src/middleware/{auth,error-handler}.ts`, `src/types/`, `src/services/{agent_executor,agent_scheduler,crm_sync,email.service,web_search}.ts`

**Auto-started on boot:** `startCrmSyncWorker()` (polls `CrmOutbox` every 5s) + `startAgentScheduler()` (checks `AgentTask` every 60s) — both in `src/main.ts`.

### Frontend (all pages `"use client"`)
- **Dashboard** `/dashboard/*` — contacts, companies, deals (kanban via @dnd-kit), tickets, agent chat, clients, documents, messages
- **Portal** `/portal/*` — deals, tickets, documents, messages, profile
- **Auth pages:** `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/portal/login`, `/portal/register`
- **Landing:** `/` — hero carousel + command palette (⌘K)

### Authentication
- JWT (`{ id, email, name, role, tenantId }`) expires 7d, stored in `localStorage` key `sg_token`
- Every request re-checks DB for `isActive`
- Roles: `OWNER` (full access), `CLIENT` (portal only)
- `requireRole(...roles)` middleware — CRM routes use `requireRole('OWNER')`
- **Role redirect:** dashboard layout → non-OWNER → `/portal`; portal layout → non-CLIENT → `/dashboard`; `/login` → CLIENT → `/portal`
- No OAuth — email/password only

### Multi-tenant
- Signup creates `Tenant` + `OWNER` user. Every model (except `CrmOutbox`) has `tenantId`. All queries filter by `req.user!.tenantId`.
- `Contact` has `@@unique([tenantId, email])`.

### Notifications
- **SSE:** `GET /api/notifications/stream/:userId?token=<jwt>` — EventSource requires token in URL. Must filter `type === "connected"` / `"keepalive"` in `onmessage`.
- **Email:** Nodemailer via Gmail SMTP (App Password). Env: `GMAIL_USER`, `GMAIL_APP_PASSWORD`.

### Agent system
- Pipeline in `src/services/agent_executor.ts` — uses Vercel AI SDK (`generateText` + tools). Falls back to deterministic mock loop when no API key.
- 4 agents: Scout (leads), Aria (sales), Nova (closing), Ember (success) — defined in `frontend/src/lib/agents.ts` + `backend/src/features/chat/agents.ts`.

### Data model (Prisma — 12 models)
`Tenant`, `User`, `Company`, `Contact`, `Deal`, `Ticket`, `Interaction`, `AgentTrajectory`, `OnboardingLink`, `AgentTask`, `ContentLibrary` (Float[] embedding), `CrmOutbox` ⚠️ **no tenantId** — cannot tenant-filter.

### File uploads
- Multer → `backend/public/uploads/`, served via Express static at `/uploads/`
- Document review: files as Ticket with `category: 'DOCUMENT_REVIEW'`, paths stored as JSON in `description`
- **`api.uploadDocument()`** takes `FormData`. Do NOT set `Content-Type` header — browser sets `multipart/form-data` boundary.

## Conventions

- **Backend: ESM** (`"type": "module"`). All local imports use `.js`. `tsconfig`: `module: NodeNext`, `moduleResolution: NodeNext`. TypeScript **^6.0.3**.
- **Frontend:** `module: esnext`, `moduleResolution: bundler`. Path alias `@/*` → `./src/*`. TypeScript **^5**.
- `backendUrl` exported from `src/lib/api.ts` (also the `BASE` for all API calls). Also export `api` object with every function.
- React 19: use `<Fragment key={...}>` not `<>` inside `.map()`.
- `api.getMe()` returns `any` — backend `User` has extra fields (`contactId`) not in frontend `DashboardUser`. Cast `as any`.
- Frontend `Contact` type has `company: {…} | null` but backend stores `companyId` scalar. Pass `companyId: "..."`.
- Portal layout: `noAuthRoutes = ["/portal/login", "/portal/register"]` to avoid redirect loops.
- Deal feedback uses `Interaction` + `channel: 'DEAL_FEEDBACK'`. Client = `direction: 'INBOUND'`, admin reply = `direction: 'OUTBOUND'`. Admin reply notifies client via SSE.
- Conversations stored in `localStorage` key `salesgenius.conversations.v1`. Hydrated in `useEffect` (SSR-safe).

## Tailwind CSS 4

PostCSS plugin: `@tailwindcss/postcss`. Global CSS imports Tailwind and custom theme:
```css
@import "tailwindcss";
@theme {
  --color-canvas: #f9fbe7;
  --color-panel: #f0edd4;
  --color-peach: #eccdb4;
  --color-ink: #2d2424;
  --color-coral: #fea1a1;
  /* … */
}
```
Custom tokens available as `bg-canvas`, `text-ink`, etc.

## Key files

| Purpose | File |
|---------|------|
| Backend entry | `src/main.ts` |
| Express app | `src/app.ts` |
| Auth middleware + JWT | `src/middleware/auth.ts` |
| Env config | `src/config/env.ts` |
| Prisma client | `src/core/database.ts` |
| Agent executor | `src/services/agent_executor.ts` |
| Agent scheduler | `src/services/agent_scheduler.ts` |
| SSE notifications | `src/features/notifications/notifications.controller.ts` |
| Seed (`.mjs`) | `prisma/seed.runtime.mjs` |
| Frontend API client | `src/lib/api.ts` |
| Frontend types | `src/lib/types.ts` |
| Dashboard layout | `src/app/dashboard/layout.tsx` |
| Portal layout | `src/app/portal/layout.tsx` |
| Agent definitions | `src/lib/agents.ts` |
| Conversation hook | `src/hooks/use-conversations.ts` |

## Gotchas

- **Next.js 16 breaking changes:** Read `node_modules/next/dist/docs/` before writing code. See also `frontend/AGENTS.md`.
- **SSE token in URL:** `EventSource` can't send custom headers. Token passed as `?token=<jwt>`. Stream endpoint decodes JWT directly (no `authMiddleware`).
- **CrmOutbox no tenantId:** Model lacks `tenantId` column — cannot filter by tenant without a migration.
- **Seed file:** `prisma/seed.runtime.mjs` (`.mjs`, not `.ts`). Run with `npx tsx`, not `node`.
- **JWT secret:** Falls back to `'sg-dev-secret'` if `JWT_SECRET` unset.
- **FRONTEND_URL:** Defaults to `http://localhost:3000`. Controls CORS origin in `app.ts`.
- **Prisma v7:** Uses `prisma.config.ts` (not just `prisma/schema.prisma`). Driver adapter: `@prisma/adapter-pg`.
- **Email:** Requires Gmail App Password. Logs `[EmailService]` messages on send.
- **Fragment keys:** React 19 requires `<Fragment key={...}>` over `<>`.
- **Root `package.json`:** Only `@emailjs/browser` — not part of either app.
- **Health:** Backend `/` returns HTML landing page (not JSON). Frontend health is Next.js built-in.
- **Postgres password:** `docker compose` uses `POSTGRES_PASSWORD=asef`, `POSTGRES_DB=salesgenius`.
