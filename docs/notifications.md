# Real-Time Notifications

## Overview

Server-Sent Events (SSE) push notification system. Uses an in-memory Node.js `EventEmitter` to broadcast events. The notification endpoint decodes JWT directly from query parameter (no `authMiddleware` — `EventSource` cannot send custom headers).

## SSE Endpoint

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/notifications/stream/:userId?token=<jwt>` | JWT in query | Stream real-time notifications |

### Connection Setup

```
GET /api/notifications/stream/:userId?token=<jwt>

Response:
  Content-Type: text/event-stream
  Cache-Control: no-cache
  Connection: keep-alive

data: { "type": "connected", "userId": "..." }

  ... events stream ...

:keepalive           ← every 30 seconds
```

### Client-Side (Frontend)

```ts
const token = localStorage.getItem("sg_token");
const es = new EventSource(`${backendUrl}/api/notifications/stream/${user.id}?token=${token}`);

es.onmessage = (e) => {
  const data = JSON.parse(e.data);
  if (data.type !== 'connected' && data.type !== 'keepalive') {
    // handle notification
  }
};
```

The `connected` and `keepalive` event types must be filtered out. The `keepalive` is sent as a comment (`:keepalive\n\n`), which browsers may deliver as `onmessage` with no data — implement null/type checks.

## Notification Events

All notification events follow this structure:

```json
{
  "userId": "uuid",
  "type": "event_type",
  "title": "Short Title",
  "message": "Description of what happened",
  "link": "/dashboard/deals",
  "createdAt": "2026-06-24T05:30:00.000Z"
}
```

## Event Types

### CRM Operations

| Type | Title | Triggered By | Recipients | Link |
|------|-------|-------------|------------|------|
| `contact_created` | "New Contact" | OWNER creates contact | Creator | — |
| `deal_created` | "New Deal" | OWNER creates deal | Creator | — |
| `ticket_created` | "New Ticket" | OWNER creates ticket | Creator | — |
| `manual` | (custom) | OWNER sends notification via `/api/crm/notifications/send` | Specified user | (optional) |

### Client Onboarding

| Type | Title | Triggered By | Recipients | Link |
|------|-------|-------------|------------|------|
| `invitation_sent` | "Invitation Sent" | OWNER generates onboarding link | Owner | `/dashboard/clients` |
| `client_onboarded` | "Client Onboarded" | CLIENT completes onboarding | All OWNERS in tenant | `/dashboard/clients` |

### Client Actions → Admin

| Type | Title | Triggered By | Recipients | Link |
|------|-------|-------------|------------|------|
| `deal_offer` | "New Deal Offer" | CLIENT submits a deal | All OWNERS | `/dashboard/deals` |
| `deal_comment` | "New Comment on Deal" | CLIENT comments on deal | All OWNERS | `/dashboard/deals` |
| `live_chat_message` | "Message from {name}" | CLIENT sends chat message | All OWNERS | `/dashboard/messages` |
| `live_chat_closed` | "Conversation Closed" | CLIENT closes conversation | All OWNERS | `/dashboard/messages` |
| `live_chat_reopened` | "Conversation Reopened" | CLIENT reopens conversation | All OWNERS | `/dashboard/messages` |
| `document_submitted` | "Document Submitted" | CLIENT uploads document | All OWNERS | `/dashboard/documents` |

### Admin Actions → Client

| Type | Title | Triggered By | Recipients | Link |
|------|-------|-------------|------------|------|
| `deal_feedback` | "Feedback on Your Deal" | OWNER comments on deal | CLIENT (deal owner) | `/portal/deals` |
| `live_chat_message` | "New Message" | OWNER sends chat message | CLIENT | `/portal/messages` |
| `live_chat_closed` | "Conversation Closed" | OWNER closes conversation | CLIENT | `/portal/messages` |
| `live_chat_reopened` | "Conversation Reopened" | OWNER reopens conversation | CLIENT | `/portal/messages` |
| `document_reviewed` | "Document Reviewed" | OWNER reviews document with feedback | CLIENT | `/portal/documents` |

### Agent System

| Type | Title | Triggered By | Recipients | Link |
|------|-------|-------------|------------|------|
| `lead_generated` | (embedded in pipeline) | Agent collects leads | (via SSE trajectory) | — |

## Architecture

### Backend (`notifications.controller.ts`)

```ts
// Global EventEmitter shared across the app
export const notificationEvents = new EventEmitter();

// Emit a notification
export function notify(userId, type, title, message, link?) {
  notificationEvents.emit('notification', {
    userId, type, title, message, link,
    createdAt: new Date().toISOString(),
  });
}

// SSE stream
export function streamNotifications(req, res) {
  // JWT verification from query token
  // SSE headers
  // Subscribe to EventEmitter
  // 30s keepalive interval
  // Cleanup on connection close
}
```

### In-Memory Delivery

- No persistence. Notifications are not stored in the database.
- If client is disconnected, the event is lost.
- The EventEmitter is in-process only — events delivered by other processes (e.g., Docker replicas) won't reach this instance.
- No message queue — directly emitted from controller code.

## Manual Notification (CRM)

The OWNER can send manual notifications to specific users:

```
POST /api/crm/notifications/send
Body: { userId, title, message, link? }
Auth: JWT + OWNER
```

## Agent Trajectory SSE (Separate Stream)

The agent system uses its own SSE endpoint for streaming AI agent thought processes:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/agent/stream/:sessionId?token=<jwt>` | Stream agent trajectory steps in real-time |

Uses a separate `trajectoryEvents` EventEmitter in `chat.controller.ts`. Two independent SSE systems:
- Notification SSE: `/api/notifications/stream/:userId?token=...`
- Trajectory SSE: `/api/agent/stream/:sessionId?token=...`
