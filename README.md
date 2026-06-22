# SalesGenius

Multi-agent AI sales/support platform.

## Structure

```
backend/   Express 5 + Prisma 7 + PostgreSQL + Vercel AI SDK — port :4000
frontend/  Next.js 16.2.9 + React 19 + Tailwind CSS 4 — port :3000
```

### Backend

- Express 5 REST API with JWT auth (OWNER / CLIENT roles)
- Prisma 7 ORM with PostgreSQL (multi-tenant)
- AI agent pipeline using Vercel AI SDK
- SSE real-time notifications
- File uploads via Multer

### Frontend

- **Admin dashboard** (`/dashboard/*`) — CRM, contacts, companies, deals (kanban), tickets, agent chat, clients, documents
- **Client portal** (`/portal/*`) — deals, tickets, documents, profile
- Next.js App Router with `"use client"` pages
- Tailwind CSS 4 styling

## Commands

| Directory | Command | Description |
|-----------|---------|-------------|
| `backend/` | `npm run dev` | Start dev server on :4000 |
| `backend/` | `npm run build` | TypeScript compile |
| `backend/` | `npm run prisma:generate` | Generate Prisma client |
| `backend/` | `npm run prisma:migrate` | Run migrations |
| `frontend/` | `npm run dev` | Start dev server on :3000 |
| `frontend/` | `npm run build` | Next.js build + typecheck |

## Auth

JWT-based authentication with 7-day expiry. Roles: `OWNER` (admin), `CLIENT` (portal).
