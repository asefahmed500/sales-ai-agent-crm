# PERFORMANCE_PLAN.md

**SalesGenius – Performance Implementation & Optimization Plan**  
**Author:** Principal Software Architect & Performance Engineer  
**Date:** 2026-06-11  
**Status:** Ready for Review

---

## 1. Plan Overview & Target Metrics

This plan provides the implementation details for the optimizations proposed in the [PERFORMANCE_AUDIT.md](file:///G:/sio/PERFORMANCE_AUDIT.md). We target the following performance metrics:

| Metric | Baseline (Expected) | Target | Method |
|:---|:---|:---|:---|
| **E2E Message Latency** | `8.5s - 15.0s` | **`< 3s`** (for standard paths) | Speculative execution, smaller model routing, semantic cache |
| **Concurrent Conversations** | `~50` | **`10,000+`** | Async IO gateway, local CRM caching, Redis memory storage |
| **Vector Search Latency** | `1.5s` (at 100k vectors) | **`< 20ms`** | pgvector HNSW Indexing |
| **API Sync Latency** | `1.5s - 4s` (HubSpot sync) | **`< 5ms`** (instant local read) | Async replica synchronization (Outbox Pattern) |
| **Dashboard Lag** | `2.0s` polling delay | **`< 100ms`** | SSE (Server-Sent Events) streaming |

---

## 2. Phase-by-Phase Implementation Plan

### Phase 1: High-Performance Database Setup (pgvector & Schema)
* **Goal:** Reduce RAG and memory retrieval latency.
* **Tasks:**
  1. Initialize PostgreSQL schema with optimized datatypes (`jsonb`, indexes on foreign keys).
  2. Implement HNSW index on the embedding columns in `interactions` and `content_library`.
  3. Set up database connection pooling (using `asyncpg` in Python).

* **HNSW Index Schema Configuration:**
  ```sql
  -- Ensure pgvector extension is enabled
  CREATE EXTENSION IF NOT EXISTS vector;

  -- Create Content Library (RAG target)
  CREATE TABLE IF NOT EXISTS content_library (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      category VARCHAR(50) NOT NULL,
      embedding VECTOR(1536) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Create HNSW index for Cosine Distance (matching OpenAI text-embedding-3-large)
  CREATE INDEX IF NOT EXISTS idx_content_library_hnsw 
  ON content_library USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
  ```

### Phase 2: Async API Gateway & Local CRM Cache (Non-Blocking Integrations)
* **Goal:** Eradicate blocking inline CRM API calls during the LLM loop.
* **Architecture:**
  - Create local cache tables for `contacts`, `companies`, and `deals`.
  - When the agent queries CRM data, it queries the local tables.
  - When the agent updates a CRM record, it writes to a local `outbox_events` table within a PostgreSQL transaction.
  - A background worker polls the outbox (or listens via PostgreSQL `LISTEN/NOTIFY`) and pushes changes to external CRM (HubSpot/Salesforce) asynchronously with a robust backoff-retry loop.

* **Outbox Pattern Table:**
  ```sql
  CREATE TABLE IF NOT EXISTS crm_outbox (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_type VARCHAR(50) NOT NULL, -- 'contact.update', 'deal.create'
      payload JSONB NOT NULL,
      status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, PROCESSING, COMPLETED, FAILED
      retry_count INT DEFAULT 0,
      error_message TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  ```

### Phase 3: Optimized Multi-Agent Executor (LangGraph + Redis)
* **Goal:** Mitigate LangGraph sequential LLM bottleneck.
* **Tactics:**
  1. **Semantic Cache:** Query Redis using vector similarity of incoming messages to check if a highly confident cached response exists.
  2. **Model Tiering:** Route support queries and simple routing decisions to a fast model (e.g. `llama3-8b` via Groq or `claude-3-haiku`). Only route complex discovery/objections to `gpt-4o` or `claude-3-sonnet`.
  3. **Parallel Sub-graph Execution:** Run independent agents (e.g., checking compliance and checking health metrics) in parallel threads via LangGraph `send` API.

### Phase 4: Next.js 15 Frontend Streaming (SSE Trajectories)
* **Goal:** Real-time updates without polling.
* **Implementation:**
  - Implement a FastAPI SSE endpoint `/api/stream/trajectory/{session_id}`.
  - As the agent runs through the LangGraph execution loop, it emits events containing intermediate `thoughts`, `actions`, and `observations`.
  - Next.js subscribes to this stream using native `EventSource` and updates the React state dynamically.

---

## 3. Recommended Codebase Structures (Skeletons)

When approved, we will build out the following project structure:

```
G:\sio\
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── database.py       # asyncpg Connection Pool
│   │   │   └── security.py
│   │   ├── models/
│   │   │   ├── crm.py            # Local Cache tables
│   │   │   └── outbox.py         # Outbox model
│   │   ├── services/
│   │   │   ├── agent_executor.py # LangGraph + LiteLLM
│   │   │   ├── crm_sync.py       # Async CRM Sync worker
│   │   │   └── semantic_cache.py # Redis cache service
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── endpoints.py  # SSE Trajectory streaming
│   │   │       └── webhooks.py   # Inbound webhook ingestion
│   │   └── main.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── dashboard/        # Dashboard with SSE integration
│   │   │   └── page.tsx
│   │   └── components/
│   │       └── trajectory-stream.tsx # Streaming UI Component
│   ├── package.json
│   └── next.config.ts
└── prd.md
```

---

## 4. Verification and Testing Strategy

1. **Database performance testing:** Run pgbench on local PostgreSQL instance to verify query times on pgvector indices with varying dataset sizes (up to 1,000,000 records).
2. **End-to-End Latency load testing:** Use `locust` or `k6` to simulate 10,000 concurrent conversations sending messages to FastAPI, ensuring that local database queries and Redis session handling stay under 50ms (excluding LLM inference latency).
3. **LLM Cost/Latency Monitoring:** Integrate **LangFuse** or **LangSmith** to measure and trace the exact duration of each agent step in the LangGraph chain.
