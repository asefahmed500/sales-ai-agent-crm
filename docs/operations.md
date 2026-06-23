# Operations, Data Model & Context Tracking

## Database Schema (Prisma — 12 Models)

The database is PostgreSQL via `pgvector/pgvector:pg16` (pgvector extension for embeddings). Prisma 7 with driver adapter (`@prisma/adapter-pg`).

### Model Overview

```
Tenant ────────┬── User (OWNER / CLIENT)
               ├── Company
               ├── Contact ───┐
               ├── Deal ──────┤
               ├── Ticket ────┤
               ├── Interaction ──── AgentTrajectory
               ├── OnboardingLink
               ├── AgentTask
               ├── ContentLibrary
CrmOutbox (no tenantId)
```

### Tenant

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Primary key |
| `name` | String | Company/org name |
| `subdomain` | String? | Unique (future multi-subdomain support) |

### User

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | |
| `tenantId` | UUID | FK → Tenant |
| `email` | String | **Unique** (global, single sign-on model) |
| `password` | String | bcrypt hashed |
| `name` | String | |
| `role` | String | `OWNER` or `CLIENT` |
| `contactId` | UUID? | FK → Contact (links CLIENT to CRM contact) |
| `isActive` | Boolean | Default `true` |

### Company

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | |
| `tenantId` | UUID | FK → Tenant |
| `name` | String | |
| `domain` | String? | Company website domain |
| `industry` | String? | |
| `size` | String? | e.g., "1-10", "51-200" |
| `score` | Float | Default 0.0 (lead scoring) |
| `tags` | String[] | Array tags |

### Contact

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | |
| `tenantId` | UUID | FK → Tenant |
| `companyId` | UUID? | FK → Company |
| `name` | String | |
| `email` | String | |
| `phone` | String? | |
| `role` | String? | Decision-maker role |
| `stage` | String | `LEAD` → `DISCOVERY` → `PROPOSAL` → `NEGOTIATION` → `WON` / `LOST` |
| `status` | String | `ACTIVE` / `INACTIVE` |
| `score` | Float | Lead score (0-100) |
| `source` | String? | CRM import channel |
| `tags` | String[] | e.g., `['web-lead', 'scout']` |
| `customFields` | JSON | Extensible custom data |
| `healthScore` | Float | Default 100.0 |
| `enrichedAt` | DateTime? | Last enrichment timestamp |

**Unique constraint:** `@@unique([tenantId, email])`

**Stage progression:** `LEAD` → `DISCOVERY` → `PROPOSAL` → `NEGOTIATION` → `WON` / `LOST` (onboarding sets to `WON`)

### Deal

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | |
| `tenantId` | UUID | |
| `contactId` | UUID? | FK → Contact |
| `companyId` | UUID? | FK → Company |
| `name` | String | |
| `stage` | String | Pipeline stage (kanban) |
| `amount` | Float | Deal value |
| `status` | String | `OPEN` / `WON` / `LOST` |
| `closeReason` | String? | |
| `notes` | String? | |

### Ticket

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | |
| `tenantId` | UUID | |
| `contactId` | UUID? | |
| `companyId` | UUID? | |
| `subject` | String | |
| `description` | String | |
| `priority` | String | `LOW` / `MEDIUM` / `HIGH` / `URGENT` |
| `status` | String | `OPEN` / `PENDING_REVIEW` / `RESOLVED` / `CLOSED` |
| `category` | String | `GENERAL` / `TECHNICAL` / `BILLING` / `DOCUMENT_REVIEW` |

### Interaction

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | |
| `tenantId` | UUID | |
| `contactId` | UUID? | |
| `companyId` | UUID? | |
| `dealId` | UUID? | |
| `channel` | String | `LIVE_CHAT` / `DEAL_FEEDBACK` / `DOCUMENT_REVIEW` / `CHAT` |
| `direction` | String | `INBOUND` / `OUTBOUND` / `SYSTEM` |
| `content` | String | Message body |
| `summary` | String? | AI-generated summary |
| `sentiment` | String | `POSITIVE` / `NEUTRAL` / `NEGATIVE` |

Interaction is the universal audit trail — every message, comment, and system action is recorded here.

### AgentTrajectory

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | |
| `interactionId` | UUID | FK → Interaction |
| `thought` | String | Agent's reasoning step |
| `action` | String | Tool name or action type |
| `params` | JSON | Tool input parameters |
| `result` | String? | Tool output |
| `confidence` | Float | Default 1.0 |
| `createdAt` | DateTime | |

Trajectory provides full auditability of AI agent decisions.

### OnboardingLink

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | |
| `token` | String | **Unique** — 64-char hex |
| `tenantId` | UUID | |
| `contactId` | UUID | |
| `companyId` | UUID | |
| `status` | String | `PENDING` → `USED` |
| `expiresAt` | DateTime | 7 days |
| `usedAt` | DateTime? | |

### AgentTask

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | |
| `tenantId` | UUID | |
| `agent` | String | scout/rep/closer/success |
| `type` | String | research_niche, check_pipeline, etc. |
| `status` | String | `ACTIVE` / `PAUSED` / `FAILED` |
| `config` | JSON | Task configuration |
| `interval` | Int | Seconds between runs (default 3600) |
| `lastRunAt` | DateTime? | |
| `nextRunAt` | DateTime? | |

### ContentLibrary

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | |
| `tenantId` | UUID | |
| `companyId` | UUID | FK → Company |
| `title` | String | Article/guide title |
| `content` | String | Full text |
| `category` | String | e.g., "pricing", "onboarding" |
| `embedding` | Float[] | pgvector embedding for semantic search |

### CrmOutbox

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | |
| `eventType` | String | `contact.update`, `deal.create` |
| `payload` | JSON | Event data |
| `status` | String | `PENDING` → `PROCESSING` → `COMPLETED` / `FAILED` |
| `retryCount` | Int | Max 5 |
| `errorMessage` | String? | |

**⚠️ No `tenantId` column** — cannot be filtered by tenant without a migration.

## Context Tracking & Audit Trail

### Interaction = Universal Audit Log

Every meaningful action in the system creates an `Interaction` record:

| Channel | Direction | What Creates It |
|---------|-----------|-----------------|
| `CHAT` | INBOUND | User message to agent |
| `CHAT` | OUTBOUND | Agent response |
| `LIVE_CHAT` | INBOUND | CLIENT sends message to admin |
| `LIVE_CHAT` | OUTBOUND | Admin replies to CLIENT |
| `LIVE_CHAT` | SYSTEM | Conversation open/close markers |
| `DEAL_FEEDBACK` | INBOUND | CLIENT comments on deal |
| `DEAL_FEEDBACK` | OUTBOUND | ADMIN comments on deal |
| `DOCUMENT_REVIEW` | INBOUND | Reviewer feedback on document |

### System Markers

- **`__CLOSED__`** — system marker in `LIVE_CHAT` channel with `direction: 'SYSTEM'` indicates conversation is closed
- Deleting all `SYSTEM` markers with `content === '__CLOSED__'` reopens a conversation

### Sentiment Analysis

Basic rule-based sentiment on all inbound interactions:
- Contains "angry", "broken", "terrible", "cancel" → `NEGATIVE`
- Contains "great", "love", "awesome", "happy" → `POSITIVE`
- Otherwise → `NEUTRAL`

## CRM Controller Operations

### Dashboard Stats

`GET /api/crm/dashboard` returns:
- `totalContacts`, `totalCompanies`, `totalDeals`, `totalTickets`
- `openDealsValue`, `openDealsCount`, `wonDealsValue`, `wonDealsCount`
- `contactsByStage` (groupBy stage), `dealsByStage` (groupBy stage + sum amounts)
- `recentContacts` (last 5), `recentDeals` (last 5, with company + contact)

### Pipeline (Kanban)

`GET /api/crm/pipeline` returns deals grouped by stage:
```
PROSPECT, QUALIFIED, DISCOVERY, PROPOSAL, NEGOTIATION, CLOSED_WON, CLOSED_LOST
```

Frontend renders this as a kanban board using `@dnd-kit/core` + `@dnd-kit/sortable`.

### CRUD Patterns

All CRM list endpoints support pagination (`?page=1&limit=20`) and filtering:
- Contacts: `?search=`, `?stage=`, `?status=`
- Companies: `?search=`
- Deals: `?search=`, `?stage=`, `?status=`
- Tickets: `?status=`, `?priority=`

All CRUD verify tenant ownership before operations — every `findFirst` includes `{ tenantId: req.user!.tenantId }`.

### Live Chat (Admin)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/crm/conversations` | List all contacts with last message + total message count |
| `GET /api/crm/conversations/:contactId/messages` | Full conversation history |
| `POST /api/crm/conversations/:contactId/messages` | Send admin reply |
| `POST /api/crm/conversations/:contactId/close` | Close conversation |
| `POST /api/crm/conversations/:contactId/reopen` | Reopen conversation |

## Error Handling

Standardized error classes in `src/core/errors.ts`:

| Class | Status | Purpose |
|-------|--------|---------|
| `AppError` | varies | Base class |
| `NotFoundError` | 404 | Resource not found |
| `UnauthorizedError` | 401 | Missing/invalid auth |
| `ForbiddenError` | 403 | Insufficient role |
| `ValidationError` | 400 | Invalid input |
| `ConflictError` | 409 | Duplicate resource |

Response helpers in `src/core/response.ts`:
- `ok(res, data, status?)` — defaults to 200
- `created(res, data)` — 201
- `noContent(res)` — 204

Global error handler in `src/middleware/error-handler.ts` catches all `AppError` instances and returns `{ error: message }`.
