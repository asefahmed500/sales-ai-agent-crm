# AI Agent System

## Overview

SalesGenius has 4 AI agents that form a complete sales pipeline: Scout (leads), Aria (sales), Nova (closing), Ember (success). The agent pipeline uses Vercel AI SDK (`generateText` + tools) with a deterministic fallback orchestrator when no API key is available.

## Agents

| ID | Name | Role | Stage | Icon | Description |
|----|------|------|-------|------|-------------|
| `scout` | Scout | Lead Generation | PROSPECT | radar | Finds & qualifies new leads via web search |
| `rep` | Aria | Sales Engagement | QUALIFIED | chat | Engages leads, discovery, demos, pricing |
| `closer` | Nova | Closing | NEGOTIATION | target | Proposals, quotes, negotiation, contracts |
| `success` | Ember | Customer Success | CLOSED_WON | sparkle | Onboarding, support, tickets, renewals |

Agent definitions are duplicated in two files (must be kept in sync):
- **Backend:** `backend/src/features/chat/agents.ts`
- **Frontend:** `frontend/src/lib/agents.ts`

## Agent Chat Routes (`/api/agent/*`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/agents` | None | List all agent definitions |
| POST | `/api/agent/chat` | JWT | Submit chat message to agent pipeline |
| GET | `/api/agent/stream/:sessionId` | JWT (query) | SSE stream of agent trajectory |
| GET | `/api/agent/trajectory/:interactionId` | JWT | Get stored trajectory steps |
| GET | `/api/interactions/:contactId` | JWT | List all interactions for a contact |

## Chat Flow

```
User → POST /api/agent/chat { sessionId, message, agent?, contactId? }

Backend:
├── authMiddleware attaches req.user (tenantId)
├── runAgentPipeline() runs asynchronously (immediate 202 "processing")
│
├── 1. Resolve contact
│   ├── If contactId: findUnique
│   └── Else: findFirst where stage in [LEAD, DISCOVERY, PROPOSAL, NEGOTIATION]
│       (ordered by most recent)
│
├── 2. Create inbound Interaction record
│   { channel, direction: 'INBOUND', content: message, sentiment }
│
├── 3. Run agent logic
│   ├── Try: runRealLLM() — generateText with tool definitions
│   └── Catch: runOrchestrator() — deterministic intent router
│
├── 4. Create outbound Interaction record
│   { direction: 'OUTBOUND', content: response, sentiment: 'NEUTRAL' }
│
├── 5. Queue CrmOutbox event
│   { eventType: 'contact.update', payload: { agent, contactId, message } }
│
└── 6. Emit 'complete' via trajectoryEvents SSE
```

## LLM Path (`runRealLLM`)

Uses Vercel AI SDK `generateText` with:

- **Model:** `process.env.AI_CHAT_MODEL` (default: `'openai/gpt-5.4'`)
- **System prompt:** Built from `buildSystemPrompt(contact, agent)` — includes agent role, current contact context, tool instructions
- **Tools:** 9 tools available (see below)
- **Stop condition:** `stepCountIs(12)` — max 12 tool calls
- **onStepFinish:** Emits trajectory events for each tool call/result

### Available Tools

| Tool | Description | Schema |
|------|-------------|--------|
| `web_search` | Search web for prospect companies | `{ niche, location?, count? }` |
| `generate_lead` | Persist researched prospect as CRM lead | `{ company, website, industry, contactName, email, ... }` |
| `handoff_to_sales` | Hand generated leads to Sales agent | `{ leadIds: string[] }` |
| `update_contact_stage` | Move contact to new stage | `{ stage: enum, reason? }` |
| `create_proposal` | Create deal/proposal | `{ dealName, amount }` |
| `close_deal` | Close active deal | `{ status: 'WON' \| 'LOST' }` |
| `search_knowledge_base` | Search internal knowledge base | `{ query }` |
| `create_ticket` | Create support ticket | `{ subject, description, priority, category? }` |
| `escalate_to_human` | Escalate to human | `{ reason, urgency? }` |

## Deterministic Orchestrator (`runOrchestrator`)

Fully functional fallback when no API key or LLM fails. Routes by intent keywords:

### Cross-Agent Commands
| Intent | Trigger | Action |
|--------|---------|--------|
| Generate leads | `/generate <niche>`, "find leads in X" | `bulkGenerate()` → creates companies + contacts |
| Handoff | `/handoff` | `handoffToSales()` → moves LEAD → DISCOVERY |
| Pipeline | `/pipeline` | Aggregates contacts by stage + deal values |
| List contacts | `/leads` | Returns recent 10 contacts |
| Escalate | "angry", "unacceptable", "refund" | `escalate(HIGH)` |

### Agent-Specific (Nova / Closer)
| Intent | Trigger | Action |
|--------|---------|--------|
| Proposal | `/proposal` | `createProposal()` with auto-detect amount |
| Close | `/close` | `closeDeal('WON')` |

### Agent-Specific (Ember / Success)
| Intent | Trigger | Action |
|--------|---------|--------|
| Ticket | `/ticket` | `createTicket()` + `searchKnowledgeBase()` |
| Renewal | "renew", "upsell" | Contextual response |

### General (Aria / Rep)
| Intent | Trigger | Action |
|--------|---------|--------|
| Pricing | "price", "cost", "plan" | `searchKnowledgeBase('pricing')` |
| Demo | "demo", "schedule" | `updateContactStage('DISCOVERY')` |

## Agent Scheduler (`src/services/agent_scheduler.ts`)

Runs scheduled agent tasks in the background.

```
startAgentScheduler()
├── runDueTasks() immediately on start
└── setInterval(runDueTasks, 60_000)

runDueTasks()
├── prisma.agentTask.findMany({ where: { status: 'ACTIVE', nextRunAt: { lte: now } } })
├── For each task:
│   ├── executeTask(task)
│   ├── Update lastRunAt + nextRunAt (current time + interval)
│   └── On error: status = 'FAILED'
└── Tasks processed: LEAD_ENRICHMENT, FOLLOW_UP, PIPELINE_ADVANCE
```

### Task Types

| Type | Agent | Description | Default Interval |
|------|-------|-------------|-----------------|
| `LEAD_ENRICHMENT` | scout | Searches web for leads (via Tavily/generator), creates companies + contacts in CRM | 3600s (1 hour) |
| `FOLLOW_UP` | rep | Finds stale DISCOVERY contacts with no recent interactions, flags for follow-up | 3600s |
| `PIPELINE_ADVANCE` | scout | Auto-advances PROSPECT contacts with score >= 70 to QUALIFIED stage | 3600s |

Scheduler tasks can be managed via CRM routes:
- `GET /api/crm/agent-tasks` — List tasks
- `POST /api/crm/agent-tasks` — Create task `{ agent, type, config, interval }`
- `PUT /api/crm/agent-tasks/:id` — Update task

## Web Search Service (`src/services/web_search.ts`)

Two-tier search:

1. **Tavily API** — if `TAVILY_API_KEY` is set, queries `https://api.tavily.com/search`
2. **Deterministic generator** — fallback that generates realistic fake leads based on the niche string (seeded by niche + location for deterministic results)

Both return the `ResearchResult` shape: `{ company, website, industry, size, contactName, email, role, snippet }`.

## Trajectory SSE Streaming

The agent system streams real-time thought process via SSE:

```
GET /api/agent/stream/:sessionId?token=<jwt>

Events:
  { type: 'connected', sessionId }
  { type: 'trajectory_step', interactionId, step: { thought, action, params, result } }
  { type: 'complete', response, outboundInteraction }
```

Frontend connects to trajectory SSE to show the agent's reasoning in real-time. Stored trajectory steps are also retrievable via `GET /api/agent/trajectory/:interactionId`.

## CRM Outbox Sync (`src/services/crm_sync.ts`)

After every agent action, a `CrmOutbox` event is created. The sync worker processes these:

```
startCrmSyncWorker()
├── setInterval(processPendingOutboxEvents, 5000)
├── Reads up to 10 PENDING events (ordered by createdAt asc)
├── For each event:
│   ├── Mark PROCESSING
│   ├── Simulate external sync (500ms delay, 5% simulated failure)
│   ├── Mark COMPLETED or retry (up to 5 retries, then FAILED)
└── Event types: contact.update, deal.create
```

## Frontend Chat Architecture

### Chat Shell (`src/components/chat-shell.tsx`)
Orchestrates the chat UI:
- Sidebar with conversation history
- Agent selector (switches between 4 agents)
- Message list with trajectory display
- Chat input with slash commands (cmd + k)
- SSE listener for trajectory streaming

### Conversation Persistence
Conversations stored in `localStorage` key `salesgenius.conversations.v1`. Hydrated in `useEffect` for SSR safety. Hook: `use-conversations.ts`.
