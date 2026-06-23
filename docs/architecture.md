# SalesGenius — System Architecture

**SalesGenius** is a multi-agent AI sales/support platform. Two independent packages, no monorepo workspace.

```
frontend/   Next.js 16.2.9 + React 19 + Tailwind CSS 4 (App Router) — port :3000
backend/    Express 5 + Prisma 7 + PostgreSQL (pgvector/pg16) + Vercel AI SDK — port :4000
```

## Tenancy Model

Multi-tenant. Signup creates a `Tenant` + `OWNER` User. Every model (except `CrmOutbox`) has a `tenantId` column — all queries filter by `req.user!.tenantId`.

- `Contact` has `@@unique([tenantId, email])` constraint.
- `CrmOutbox` is the sole model **without** `tenantId` — cannot tenant-filter without a migration.

## Auth Roles

| Role | Access |
|------|--------|
| `OWNER` | Full CRM access via `/api/crm/*` + dashboard |
| `CLIENT` | Portal access via `/api/client/*` |

## Route Map

| Mount | Feature | Auth | Purpose |
|-------|---------|------|---------|
| `/api/auth/*` | `auth/` | None / JWT | Login, register (creates tenant), forgot/reset password, me |
| `/api/crm/*` | `crm/` | JWT + OWNER | CRM CRUD — contacts, companies, deals, tickets, users, conversations, agent-tasks, dashboard |
| `/api/client/*` | `client/` | JWT + CLIENT | Portal: deals, tickets, interactions, profile, conversation |
| `/api/onboarding/*` | `onboarding/` | Mixed | Generate invitation link, verify, complete (creates CLIENT) |
| `/api/documents/*` | `documents/` | JWT + role | Upload (CLIENT), list/review (OWNER) |
| `/api/agent/*` | `chat/` | Mixed | Agent chat, trajectory SSE stream, interaction history |
| `/api/*` | `public/` | Auth | Pipeline summary, contacts/agents list, outbox events |
| `/api/notifications/*` | `notifications/` | JWT in query | SSE notification stream per user |

## Backend Structure

Feature-based. Each feature in `src/features/<name>/` owns `*.routes.ts` + `*.controller.ts`.

```
src/
├── main.ts                         # Entry: HTTP server + auto-starts background workers
├── app.ts                          # Express app factory (routes, CORS, error handler)
├── config/env.ts                   # Environment variable config
├── core/
│   ├── database.ts                 # Prisma client via driver adapter (PrismaPg)
│   ├── errors.ts                   # AppError, NotFoundError, UnauthorizedError, etc.
│   └── response.ts                 # ok(), created(), noContent() helpers
├── middleware/
│   ├── auth.ts                     # JWT generation + authMiddleware + requireRole()
│   └── error-handler.ts            # Global error handler
├── types/
│   ├── express.d.ts                # Express Request.user extension
│   └── index.ts                    # PaginatedResponse, ApiError, ApiSuccess
├── features/                       # auth/, chat/, client/, crm/, documents/,
│                                   # notifications/, onboarding/, public/
└── services/                       # Background workers + infrastructure
    ├── agent_executor.ts           # AI agent pipeline (LLM + fallback orchestrator)
    ├── agent_scheduler.ts          # Scheduled agent tasks (every 60s)
    ├── crm_sync.ts                 # CRM outbox sync worker (every 5s)
    ├── email.service.ts            # Nodemailer via Gmail SMTP
    └── web_search.ts               # Web search (Tavily) + deterministic fallback
```

## Auto-Started Background Workers

Both start in `src/main.ts` (no separate invocation needed):

| Worker | Interval | Purpose |
|--------|----------|---------|
| `startCrmSyncWorker()` | 5s | Polls `CrmOutbox` PENDING events, marks PROCESSING/COMPLETED/FAILED |
| `startAgentScheduler()` | 60s | Checks `AgentTask` for due tasks, executes them |

## Frontend Structure

All pages use `"use client"`. No server components.

```
src/app/
├── page.tsx                        # Landing page (hero carousel + ⌘K palette)
├── layout.tsx                      # Root layout (Geist fonts + globals.css)
├── globals.css                     # @import "tailwindcss" + @theme custom tokens
├── login/                          # Login page
├── signup/                         # Registration page
├── forgot-password/                # Forgot password
├── reset-password/                 # Reset password with token
├── dashboard/                      # Admin dashboard (OWNER role)
│   ├── layout.tsx                  # Sidebar nav + SSE notifications + auth guard
│   ├── user-context.tsx            # React context for DashboardUser
│   ├── page.tsx
│   ├── contacts/
│   ├── companies/
│   ├── deals/                      # Kanban board via @dnd-kit
│   ├── tickets/
│   ├── chat/                       # Agent chat interface
│   ├── clients/
│   ├── documents/
│   └── messages/                   # Live chat with CLIENT users
└── portal/                         # Client portal (CLIENT role)
    ├── layout.tsx                  # Nav + SSE notifications + auth guard
    ├── page.tsx
    ├── deals/
    ├── tickets/
    ├── documents/
    ├── messages/
    ├── profile/
    ├── login/
    └── register/                   # Onboarding registration with token
```

## Key Infrastructure Files

| Purpose | File |
|---------|------|
| Backend entry | `backend/src/main.ts` |
| Express app | `backend/src/app.ts` |
| Auth middleware + JWT | `backend/src/middleware/auth.ts` |
| Env config | `backend/src/config/env.ts` |
| Prisma client | `backend/src/core/database.ts` |
| Prisma config | `backend/prisma.config.ts` |
| Schema | `backend/prisma/schema.prisma` |
| Seed data | `backend/prisma/seed.runtime.mjs` |
| Frontend API client | `frontend/src/lib/api.ts` |
| Frontend types | `frontend/src/lib/types.ts` |
| Frontend agent defs | `frontend/src/lib/agents.ts` |
| Conversation hook | `frontend/src/hooks/use-conversations.ts` |
| Dashboard layout | `frontend/src/app/dashboard/layout.tsx` |
| Portal layout | `frontend/src/app/portal/layout.tsx` |

## Environment & Ports

| Variable | Default | Where Used |
|----------|---------|------------|
| `PORT` | `4000` | Backend server listen |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/salesgenius` | Prisma |
| `JWT_SECRET` | `'sg-dev-secret'` | JWT signing |
| `FRONTEND_URL` | `http://localhost:3000` | CORS origin + email links |
| `GMAIL_USER` | `''` | Nodemailer |
| `GMAIL_APP_PASSWORD` | `''` | Nodemailer |
| `TAVILY_API_KEY` | `''` | Web search (fallback to deterministic if absent) |
| `NEXT_PUBLIC_BACKEND_URL` | `http://localhost:4000` | Frontend API client base URL |

## Docker Compose

One `docker-compose.yml` at root:

- **db**: `pgvector/pgvector:pg16` — port :5432, password `asef`, DB `salesgenius`
- **backend**: Node 22 Alpine, applies schema + seed on startup via inline entrypoint
- **frontend**: Node 22 Alpine, Next.js standalone output, `NEXT_PUBLIC_BACKEND_URL` build arg

Postgres healthcheck (`pg_isready`) gates backend startup. Backend containers have `DATABASE_URL` overridden to the compose service name (`db:5432`).

## Key Conventions

- Backend: **ESM** (`"type": "module"`), all local imports use `.js` extension. TypeScript **^6.0.3**.
- Frontend: TypeScript **^5**. Path alias `@/*` → `./src/*`.
- React 19: use `<Fragment key={...}>` not `<>` inside `.map()`.
- No test runner. CI gate is `npm run build`.
- Frontend API client exports named functions + combined `api` object. Token stored in `localStorage` key `sg_token`.
