# SalesGenius

Multi-agent AI sales/support platform. Monorepo with two independent packages, no workspace.

## Structure

```
frontend/   Next.js 16.2.9 + React 19 + Tailwind CSS 4 (App Router) — port :3000
backend/    Express 5 + Prisma 7 + PostgreSQL + Vercel AI SDK — port :4000
```

Each has own `node_modules`, scripts, tsconfig. No shared code.

## Commands

### Backend (`backend/`)

| Command | What it does |
|---------|-------------|
| `npm run dev` | `tsx watch src/main.ts` — hot reload on :4000 |
| `npm run build` | `tsc` — compiles `src/` → `dist/` |
| `npm run prisma:generate` | Generate Prisma client (required after schema changes) |
| `npm run prisma:migrate` | Run migrations |
| `npx tsx prisma/seed.runtime.mjs` | Seed demo tenant + admin + sample data |

**Startup order:** PostgreSQL first, then `prisma generate`, then `npm run dev`.

### Frontend (`frontend/`)

| Command | What it does |
|---------|-------------|
| `npm run dev` | `next dev` — :3000 |
| `npm run build` | `next build` (typechecks too) |

No test runner. Frontend `npm run lint` (eslint) exists but CI gate is `npm run build` (typechecks too).

## Architecture

### Two apps, one backend
- **Admin dashboard** (`/dashboard/*`) — CRM: contacts, companies, deals (drag-and-drop kanban via @dnd-kit), tickets, agent chat, clients, document reviews, notifications
- **Client portal** (`/portal/*`) — client-facing: dashboard, deals (submit offers), tickets, documents (upload + feedback), profile. Login at `/portal/login`, register via magic link at `/portal/register?token=xxx`

### Backend API routes (Express)

| Route | File | Auth | Purpose |
|-------|------|------|---------|
| `/api/auth/*` | `auth.ts` | None (login/register), JWT (me) | Login, register (creates tenant), forgot/reset password |
| `/api/crm/*` | `crm.ts` | JWT + `requireRole('OWNER')` | All CRM CRUD — contacts, companies, deals, tickets, pipeline, users, agent-tasks, dashboard, deal comments |
| `/api/client/*` | `client.ts` | JWT + `requireRole('CLIENT')` | Client portal: deals (create offers), tickets, interactions, profile, deal comments |
| `/api/onboarding/*` | `onboarding.ts` | JWT (generate), none (verify/complete) | Generate invitation + CLIENT user + temp password |
| `/api/documents/*` | `documents.ts` | JWT + role | Upload files (CLIENT), list/review (OWNER) |
| `/api/*` | `endpoints.ts` | Mixed | Agent chat (`/api/agent/chat`), pipeline summary, SSE notification stream |

### Authentication
- JWT with `{ id, email, name, role, tenantId }`, expires in 7d
- Every request re-checks DB for user existence + `isActive`
- Roles: `OWNER` (full access), `CLIENT` (portal only)
- `requireRole(...roles)` middleware — CRM routes require `'OWNER'`
- **Role redirection**: dashboard layout redirects non-OWNER to `/portal`; portal layout redirects non-CLIENT to `/dashboard`; `/login` redirects CLIENT to `/portal`
- `generateToken()` in `src/middleware/auth.ts`

### Multi-tenant
- Each signup creates a `Tenant` + `OWNER` user
- Every model has `tenantId`; every query filters by `req.user!.tenantId`
- `Contact` has `@@unique([tenantId, email])` — email unique per tenant

### Notifications
- **SSE**: `GET /api/notifications/stream/:userId` emits real-time events. Frontend connects on dashboard/portal mount. Must filter `type === "connected"` in `onmessage` to avoid blank notifications.
- **Email**: Nodemailer via Gmail SMTP (App Password). Env vars: `GMAIL_USER`, `GMAIL_APP_PASSWORD`. Sends invitation, password reset, onboarding notification emails.

### Agent system
- AI agent pipeline in `src/services/agent_executor.ts` — uses Vercel AI SDK. Falls back to deterministic mock loop when no API keys set.
- Background scheduler (`agent_scheduler.ts`) runs self-executing agent tasks (lead enrichment, follow-ups, pipeline advancement) every 60s.

### Data model (Prisma — 12 models)
Tenant, User (OWNER/CLIENT), Company, Contact, Deal, Ticket, Interaction, AgentTrajectory, OnboardingLink, AgentTask, ContentLibrary (Float[] embedding), CrmOutbox

### File uploads
- Multer stores files in `backend/public/uploads/`, served via Express static at `/uploads/`
- Document review: files attached as Ticket with `category: 'DOCUMENT_REVIEW'`, file paths stored as JSON in `description`

## Key Files

| Purpose | File |
|---------|------|
| Backend entry | `src/main.ts` |
| Auth middleware + JWT | `src/middleware/auth.ts` |
| All API routers | `src/api/*.ts` |
| Email (Nodemailer) | `src/services/email.service.ts` |
| Agent executor | `src/services/agent_executor.ts` |
| SSE notifications | `src/api/endpoints.ts` (stream) |
| Seed data | `prisma/seed.runtime.mjs` |
| Frontend API client | `src/lib/api.ts` |
| Dashboard layout + sidebar | `src/app/dashboard/layout.tsx` |
| Portal layout + sidebar | `src/app/portal/layout.tsx` |

## Conventions

- Backend is **ESM** (`"type": "module"`). All local imports use `.js` extensions.
- Backend `tsconfig`: `module: NodeNext`, `moduleResolution: NodeNext`
- Frontend `tsconfig`: `module: esnext`, `moduleResolution: bundler`
- Frontend path alias: `@/*` → `./src/*`
- All frontend pages are `"use client"` (no RSC)
- Token stored in `localStorage` under key `sg_token`
- `backendUrl` exported from `src/lib/api.ts` (also serves as `BASE`)

## Gotchas

- **Fragment keys**: React 19 requires `<Fragment key={...}>` instead of `<>` inside `.map()`
- **`getMe` type**: returns `any` — backend `User` has fields (like `contactId`) not in frontend `DashboardUser` interface. Cast with `as any` when needed.
- **SSE notifications**: Must filter `type === "connected"` in `onmessage` — backend sends a `connected` event on stream open.
- **Contact type vs DB**: Frontend `Contact` has `company: {...} | null` but backend stores `companyId` scalar. Use `createContact(data: Partial<Contact> & { companyId?: string })` — pass `companyId: "..."`, not `company: { id: "..." }`.
- **Seed file**: `prisma/seed.runtime.mjs` (`.mjs`, not `.ts`) — run with `npx tsx` not `node`.
- **Next.js 16**: Check `node_modules/next/dist/docs/` for API changes before writing code — breaking changes from Next 15.
- **Portal auth**: Portal layout skips auth for `/portal/login` and `/portal/register` (stored in `noAuthRoutes`) to avoid redirect loops.
- **File upload**: `api.uploadDocument()` takes `FormData` and overrides `Content-Type` to `{}` so browser sets `multipart/form-data` boundary. Do NOT set `Content-Type` manually.
- **Email**: Relies on Gmail App Password. Check `GMAIL_USER` + `GMAIL_APP_PASSWORD` in `backend/.env`. Backend logs `[EmailService]` messages on send.
- **JWT secret**: Falls back to `'sg-dev-secret'` if `JWT_SECRET` not in `backend/.env`. Set a strong secret for anything beyond local dev.
- **Deal feedback**: Uses `Interaction` model with `channel: 'DEAL_FEEDBACK'`. Client comments are `direction: 'INBOUND'`, admin replies are `direction: 'OUTBOUND'`. Admin reply notifies the client user via SSE.
