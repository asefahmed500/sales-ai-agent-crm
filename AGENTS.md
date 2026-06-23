# SalesGenius

Multi-agent AI sales/support platform. Monorepo — two independent packages, no workspace.

## Structure

```
frontend/   Next.js 16.2.9 + React 19 + Tailwind CSS 4 (App Router) — :3000
backend/    Express 5 + Prisma 7 + PostgreSQL + Vercel AI SDK — :4000
```

Each has own `node_modules`, `tsconfig`, scripts. No shared code. No CI (`.github/workflows/` absent). No test runner in either project — CI gate is `npm run build` (typecheck).

## Quick-start

```bash
# 1. Start database
docker compose up -d db

# 2. Backend
cd backend
npm run prisma:generate
npm run dev                    # :4000

# 3. Frontend (separate terminal)
cd frontend
npm run dev                    # :3000

# Seed (optional)
cd backend && npx tsx prisma/seed.runtime.mjs
```

## Commands

### Backend (`backend/`)
| Command | What |
|---------|------|
| `npm run dev` | `tsx watch src/main.ts` — hot reload |
| `npm run build` | `tsc` — `src/` → `dist/` |
| `npm run prisma:generate` | Generate Prisma client (after schema changes) |
| `npm run prisma:migrate` | Run migrations |

Startup order: **PostgreSQL → `prisma generate` → `npm run dev`**

### Frontend (`frontend/`)
| Command | What |
|---------|------|
| `npm run dev` | `next dev` — :3000 |
| `npm run build` | `next build` (typechecks too) |
| `npm run lint` | ESLint (not a CI gate) |

Full-stack Docker: `docker compose up` (builds both, applies schema, seeds, starts on :3000 + :4000)

## Architecture

### Backend (feature-based)
Each feature in `src/features/<name>/` owns `*.routes.ts` + `*.controller.ts`.

| Mount | Feature | Auth | Purpose |
|-------|---------|------|---------|
| `/api/auth/*` | `auth/` | None / JWT | Login, register (creates tenant), forgot/reset password, me |
| `/api/crm/*` | `crm/` | JWT + OWNER | CRM CRUD — contacts, companies, deals, tickets, users, conversations, agent-tasks, dashboard |
| `/api/client/*` | `client/` | JWT + CLIENT | Portal: deals, tickets, interactions, profile, conversation |
| `/api/onboarding/*` | `onboarding/` | Mixed | Generate invitation link, verify, complete (creates CLIENT user) |
| `/api/documents/*` | `documents/` | JWT + role | Upload (CLIENT), list/review (OWNER) |
| `/api/agent/*` | `chat/` | Mixed | Agent chat, trajectory SSE stream, interaction history |
| `/api/*` | `public/` | Mixed | Pipeline summary, contacts list, agents list |
| `/api/notifications/*` | `notifications/` | JWT in query | SSE notification stream per user |

Other structural dirs: `src/config/env.ts`, `src/core/{database,errors,response}.ts`, `src/middleware/{auth,error-handler}.ts`, `src/types/`, `src/services/{agent_executor,agent_scheduler,crm_sync,email.service,web_search}.ts`

### Frontend (all pages `"use client"`)
- **Admin dashboard** `/dashboard/*` — contacts, companies, deals (kanban via @dnd-kit), tickets, agent chat, clients, documents, messages
- **Client portal** `/portal/*` — dashboard, deals, tickets, documents (upload + feedback), messages, profile
- Auth pages: `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/portal/login`, `/portal/register`

### Authentication
- JWT (`{ id, email, name, role, tenantId }`) expires 7d, stored in `localStorage` key `sg_token`
- Every request re-checks DB for `isActive`
- Roles: `OWNER` (full access), `CLIENT` (portal only)
- `requireRole(...roles)` middleware — CRM routes use `requireRole('OWNER')`
- **Role redirect**: dashboard layout → non-OWNER gets sent to `/portal`; portal layout → non-CLIENT gets sent to `/dashboard`; `/login` → CLIENT gets sent to `/portal`
- `generateToken()` in `src/middleware/auth.ts`
- No OAuth providers — email/password only

### Multi-tenant
- Signup creates `Tenant` + `OWNER` user. Every model has `tenantId`. All queries filter by `req.user!.tenantId`.
- `Contact` has `@@unique([tenantId, email])`.

### Notifications
- **SSE**: `GET /api/notifications/stream/:userId?token=<jwt>` — EventSource requires token in URL (no custom headers). Must filter `type === "connected"` / `"keepalive"` in `onmessage`.
- **Email**: Nodemailer via Gmail SMTP (App Password). Env: `GMAIL_USER`, `GMAIL_APP_PASSWORD`. Sends invitation, password reset, onboarding notification.

### Agent system
- Agent pipeline in `src/services/agent_executor.ts` — uses Vercel AI SDK (`generateText` + tools). Falls back to deterministic mock loop when no API key set.
- Background scheduler (`agent_scheduler.ts`) runs self-executing agent tasks every 60s.

### Data model (Prisma — 12 models)
`Tenant`, `User` (OWNER/CLIENT), `Company`, `Contact`, `Deal`, `Ticket`, `Interaction`, `AgentTrajectory`, `OnboardingLink`, `AgentTask`, `ContentLibrary` (Float[] embedding), `CrmOutbox` ⚠️ **no tenantId column** — cannot tenant-filter.

### File uploads
- Multer → `backend/public/uploads/`, served via Express static at `/uploads/`
- Document review: files attached as Ticket with `category: 'DOCUMENT_REVIEW'`, file paths stored as JSON in `description`
- `api.uploadDocument()` takes `FormData`. Do NOT set `Content-Type` — omit it so browser sets `multipart/form-data` boundary.

## Conventions

- Backend: **ESM** (`"type": "module"`). All local imports use `.js` extensions. `tsconfig`: `module: NodeNext`, `moduleResolution: NodeNext`.
- Frontend: `tsconfig`: `module: esnext`, `moduleResolution: bundler`. Path alias `@/*` → `./src/*`.
- `backendUrl` exported from `src/lib/api.ts` (also the `BASE` for all API calls).
- React 19: use `<Fragment key={...}>` not `<>` inside `.map()`.
- `api.getMe()` returns `any` — backend `User` has fields (like `contactId`) not in frontend `DashboardUser`. Cast `as any` when needed.
- Frontend `Contact` type has `company: {…} | null` but backend stores `companyId` scalar. Pass `companyId: "..."`, not `company: { id: "..." }`.
- Portal layout skips auth for `/portal/login` and `/portal/register` (`noAuthRoutes` list) to avoid redirect loops.
- Deal feedback: uses `Interaction` + `channel: 'DEAL_FEEDBACK'`. Client = `direction: 'INBOUND'`, admin reply = `direction: 'OUTBOUND'`. Admin reply notifies client via SSE.

## Key files

| Purpose | File |
|---------|------|
| Backend entry | `src/main.ts` |
| Express app factory | `src/app.ts` |
| Auth middleware + JWT | `src/middleware/auth.ts` |
| Error handler | `src/middleware/error-handler.ts` |
| Env config | `src/config/env.ts` |
| Errors | `src/core/errors.ts` |
| Prisma client | `src/core/database.ts` |
| Agent executor | `src/services/agent_executor.ts` |
| Agent scheduler | `src/services/agent_scheduler.ts` |
| Email (Nodemailer) | `src/services/email.service.ts` |
| SSE notifications | `src/features/notifications/notifications.controller.ts` |
| Seed data | `prisma/seed.runtime.mjs` |
| Frontend API client | `src/lib/api.ts` |
| Frontend types | `src/lib/types.ts` |
| Dashboard layout | `src/app/dashboard/layout.tsx` |
| Portal layout | `src/app/portal/layout.tsx` |
| Agent definitions | `src/lib/agents.ts` |
| Conversation hook | `src/hooks/use-conversations.ts` |

## Gotchas

- **SSE token in URL**: `EventSource` cannot send custom headers. Token passed as `?token=<jwt>` query param. The stream endpoint decodes JWT directly (does not use `authMiddleware`).
- **CrmOutbox no tenantId**: The `CrmOutbox` model lacks a `tenantId` column. Cannot tenant-filter without a migration.
- **Seed file**: `prisma/seed.runtime.mjs` (`.mjs`, not `.ts`). Run with `npx tsx`, not `node`.
- **JWT secret**: Falls back to `'sg-dev-secret'` if `JWT_SECRET` unset in `backend/.env`.
- **Email**: Requires Gmail App Password. Logs `[EmailService]` messages on send.
- **Prisma v7**: Uses `prisma.config.ts` (not `prisma/schema.prisma` alone) for config. Driver adapter via `@prisma/adapter-pg`.
- **Next.js 16 breaking changes**: Check `node_modules/next/dist/docs/` before writing code.
- **Fragment keys**: React 19 requires `<Fragment key={...}>` over `<>`.
- **`use-conversations.ts`**: Conversations stored in `localStorage` key `salesgenius.conversations.v1`. Hook hydrates from storage in `useEffect` (SSR-safe).
- **Deploy**: `docker compose up` builds and runs all services. Backend entrypoint applies schema + seeds on startup.
- **Health**: Backend `/` returns HTML landing page (not JSON). Frontend health is Next.js built-in.
