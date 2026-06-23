# Client Portal

## Overview

The client portal provides a dedicated interface for `CLIENT`-role users. CLIENT users are created via the onboarding flow (not self-registration). The portal routes are under `/portal/*` in the frontend and `/api/client/*` in the backend.

## Frontend Routes

| Path | Layout | Description |
|------|--------|-------------|
| `/portal/login` | None (noAuthRoutes) | CLIENT login |
| `/portal/register` | None (noAuthRoutes) | Onboarding registration with token |
| `/portal` | PortalLayout | Dashboard (CLIENT's deals, tickets summary) |
| `/portal/deals` | PortalLayout | View deals, create new deal offer |
| `/portal/tickets` | PortalLayout | View & create support tickets |
| `/portal/documents` | PortalLayout | Upload documents, view review status |
| `/portal/messages` | PortalLayout | Live chat with admin (OWNER) |
| `/portal/profile` | PortalLayout | Update name/phone |

## Backend Routes (`/api/client/*`)

All routes require `authMiddleware + requireRole('CLIENT')`.

### Profile

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/client/me` | Get CLIENT profile (includes contact + company) |
| PUT | `/api/client/profile` | Update name/phone (propagated to Contact record) |

### Deals

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/client/deals` | List CLIENT's deals (via contactId) |
| POST | `/api/client/deals` | Create new deal offer (notifies all OWNERS) |
| GET | `/api/client/deals/:id/comments` | Get deal feedback (DEAL_FEEDBACK channel) |
| POST | `/api/client/deals/:id/comments` | Add comment to deal (notifies all OWNERS) |

### Tickets

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/client/tickets` | List CLIENT's tickets |
| POST | `/api/client/tickets` | Create support ticket |

### Live Chat

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/client/conversation/messages` | Get chat history (LIVE_CHAT channel) |
| POST | `/api/client/conversation/messages` | Send chat message (notifies all OWNERS) |
| POST | `/api/client/conversation/close` | Close conversation (inserts `__CLOSED__` marker) |
| POST | `/api/client/conversation/reopen` | Reopen conversation (removes `__CLOSED__` markers) |

### Interactions

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/client/interactions` | List all CLIENT's interactions |

## Portal Architecture

### Layout (`portal/layout.tsx`)

The portal layout handles:

1. **Auth guard**: Checks `sg_token` in localStorage. If missing → redirect to `/portal/login`. If role is not `CLIENT` → redirect to `/dashboard`.
2. **No-auth routes**: `["/portal/login", "/portal/register"]` skip auth entirely to avoid redirect loops.
3. **Navigation**: 6 nav items: Dashboard, My Deals, My Tickets, Messages, Documents, Profile.
4. **SSE notifications**: Connects to `/api/notifications/stream/:userId?token=...` to receive real-time notifications from admin actions.
5. **Bell icon**: Shows unread notification count with dropdown.

### Deal Feedback Loop

Deal comments use the `Interaction` model with `channel: 'DEAL_FEEDBACK'`:

- **CLIENT → ADMIN**: `direction: 'INBOUND'` — notifies all OWNERS via SSE
- **ADMIN → CLIENT**: `direction: 'OUTBOUND'` — notifies the specific CLIENT via SSE

### Document Upload

Documents are stored as `Ticket` records with `category: 'DOCUMENT_REVIEW'`:

- File paths stored as JSON array in `ticket.description`
- Files stored on disk at `backend/public/uploads/`
- Served at `/uploads/` via Express static middleware
- Supports up to 5 files per upload (controlled by Multer config)
- Max file size: 20MB

Frontend upload pattern (`api.uploadDocument()`):
```ts
const formData = new FormData();
formData.append("files", file);
formData.append("title", title);
// Do NOT set Content-Type header — let browser set multipart/form-data boundary
await fetch(`${BASE}/api/documents/upload`, { method: "POST", body: formData, headers: { Authorization: `Bearer ${token}` } });
```

### Live Chat

Chat messages use the `Interaction` model with `channel: 'LIVE_CHAT'`:

- Conversation state tracked via `__CLOSED__` marker interactions (direction: `SYSTEM`)
- Closing deletes all existing `__CLOSED__` markers, then inserts a new one
- Reopening deletes all `__CLOSED__` markers
- Admin conversations are scoped to individual contacts (via `contactId`)
- Client conversations are auto-scoped to their own `contactId`

## Onboarding Registration Page

`/portal/register?token=...`:

1. Reads `token` from URL query
2. Calls `GET /api/onboarding/verify/:token` — validates token, returns contact + company info
3. Shows welcome screen with contact name and company name
4. User sets or receives credentials
5. Calls `POST /api/onboarding/complete/:token` — activates account
6. Redirects to `/portal/login`
