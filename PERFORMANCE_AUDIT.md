# PERFORMANCE_AUDIT.md

**SalesGenius – Performance Audit & Architectural Analysis**  
**Author:** Principal Software Architect & Performance Engineer  
**Date:** 2026-06-11  
**Status:** Complete (Pending Review)

---

## 1. Executive Summary

This performance audit evaluates the proposed architectural specification for **SalesGenius** detailed in the [Product Requirements Document](file:///G:/sio/prd.md). The target system is a multi-agent autonomous agent platform with real-time operations, strict latency constraints (`<1s` acknowledgment, `<5s` response), and high concurrency expectations (`10,000+` concurrent conversations).

Given that the current codebase directories ([backend](file:///G:/sio/backend)) and ([frontend](file:///G:/sio/frontend)) are empty, this audit evaluates the **design patterns, tech stack selection, data flows, and potential engineering pitfalls** of the proposed system.

### Key Latency Goals vs. Architectural Risks
1. **Goal:** Lead response / message response `< 5s` response.
   - *Risk:* A multi-agent LangGraph workflow running sequential LLM reasoning steps (ReAct loop) + RAG search + CRM lookups will realistically take **10–20 seconds** per message, failing the SLA by 200-400%.
2. **Goal:** `10,000+` concurrent conversations.
   - *Risk:* Thread-based API gateway handling blocking I/O (e.g. synchronous CRM API calls) will lead to resource exhaustion (database connections, Celery workers) and system failure under load.

---

## 2. Detailed Architectural Bottlenecks

### 2.1 Multi-Agent Orchestration Layer (LangGraph & LiteLLM)
* **Description:** A supervisor routes events to specialized agents (LeadGen, Sales, Support, etc.) that execute ReAct/Plan-and-Execute loops.
* **Bottleneck 1: Sequential LLM Reasoning Steps**
  - *Root Cause:* If the supervisor requires 1 LLM turn, the target agent requires 2 turns (thought -> tool call -> observation -> final thought), and the compliance layer requires 1 turn, that is **4 sequential LLM calls**. At `~1.2s` per call, this is `4.8s` of pure LLM latency, leaving no room for network overhead, database lookups, or third-party API executions.
  - *Estimated Impact:* Critical (agent response latency `> 8-15s`).
  - *Recommended Fix:* Implement **Parallel Agent Processing**, **Speculative Execution**, and **Semantic Caching** for routing and general support questions. Use smaller, faster models (e.g., Llama-3-8B or Claude 3.5 Haiku) for routing/supervisor roles, and only call GPT-4o/Sonnet for complex reasoning.
* **Bottleneck 2: LiteLLM Router Overhead**
  - *Root Cause:* Dynamic routing of LLM calls across providers without connection reuse or DNS caching.
  - *Estimated Impact:* Low (adds 50-150ms per request).
  - *Recommended Fix:* Warm connection pools, keep-alive headers, and local model fallbacks.

### 2.2 Database Layer (PostgreSQL, pgvector, TimescaleDB)
* **Description:** PostgreSQL serves as the primary OLTP store, pgvector handles long-term semantic memory, and TimescaleDB tracks health metrics.
* **Bottleneck 3: Unindexed pgvector Search**
  - *Root Cause:* Performing cosine similarity queries across a large `interactions` or `content_library` table without an HNSW (Hierarchical Navigable Small World) index requires a full-table scan (exact nearest neighbor search).
  - *Estimated Impact:* High (increases search latency from `<10ms` to `>1.5s` as memory grows).
  - *Recommended Fix:* Create an HNSW index using the appropriate distance metric (e.g., Cosine/Inner Product) on the embedding columns:
    ```sql
    CREATE INDEX ON content_library USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
    ```
* **Bottleneck 4: Context Retrieval N+1 Queries**
  - *Root Cause:* The orchestrator sequentially fetches the active conversation state from Redis, contacts the SQL database to load CRM contact info, retrieves company data, queries deals, and then performs a vector search.
  - *Estimated Impact:* Medium-High (adds 200-500ms of database round-trip times).
  - *Recommended Fix:* Implement **Eager Loading** and compile database retrievals into a single unified query or use a parallelized `asyncio.gather` pipeline.

### 2.3 External Integrations (CRM, Email, Calendars, Payments)
* **Description:** Direct API integrations with Salesforce, HubSpot, Nylas, SendGrid, Stripe, etc.
* **Bottleneck 5: Inline Synchronous Third-Party API Calls**
  - *Root Cause:* Calling HubSpot or Nylas APIs directly inside the agent’s execution loop blocks the worker thread while waiting for a remote HTTP response.
  - *Estimated Impact:* Critical (adds 500ms to 3s per call; high risk of timeout, rate limiting, and failure cascade).
  - *Recommended Fix:* Implement a **Local Replica CRM Sync Engine**. The agent must only read/write to a local PostgreSQL-based CRM cache. A background sync service using Webhooks + NATS/Kafka queue propagates changes bidirectionally and handles retries asynchronously.

### 2.4 Queueing & Background Processing (Kafka, Celery)
* **Description:** Kafka/NATS routes incoming webhooks; Celery processes asynchronous jobs.
* **Bottleneck 6: Blocking I/O in Prefork Celery Workers**
  - *Root Cause:* Default Celery workers use a prefork pool (process-based). If workers block on LLM or external API calls, the queue will back up immediately, leading to high message lag.
  - *Estimated Impact:* High (limits throughput to the number of processes; runs out of memory quickly).
  - *Recommended Fix:* Use **asyncio-based workers** (e.g. FastAPI's native async event handling, or Celery with the `gevent`/`eventlet` pool for high-concurrency I/O-bound operations).

### 2.5 Frontend Layer (Next.js 15 Dashboard)
* **Description:** Admin control panel displaying live agent trajectories, analytics, and enabling manual takeover.
* **Bottleneck 7: Live Trajectory Polling**
  - *Root Cause:* Using standard HTTP polling (`GET /api/trajectories` every 2s) to render live agent thoughts/actions causes massive DB load and high dashboard latency.
  - *Estimated Impact:* High (leads to DB locking and slow dashboard UI).
  - *Recommended Fix:* Use **Server-Sent Events (SSE)** or **WebSockets** for streaming trajectories directly from the agent executor to the frontend, bypassing regular OLTP database tables for transient streaming data.

---

## 3. Prioritized Bottleneck Matrix

| ID | Bottleneck | Target Component | Estimated Impact | Complexity / Risk | Priority / ROI |
|:---|:---|:---|:---|:---|:---|
| **B1** | Sequential LLM Reasoning Steps | Agent Orchestration | **Critical** (`>5s` overhead) | High / Medium | **High Priority (ROI 1)** |
| **B5** | Inline Synchronous CRM/Email APIs | Integrations | **Critical** (`>2s` overhead) | High / Low | **High Priority (ROI 2)** |
| **B3** | Unindexed pgvector Search | Database | **High** (`>1.5s` growth) | Low / Low | **High Priority (ROI 3)** |
| **B4** | Context Retrieval N+1 Queries | Database | **Medium** (`200-500ms`) | Low / Low | **Medium Priority (ROI 4)** |
| **B7** | Live Trajectory Polling | Frontend / API | **High** (DB stress) | Medium / Low | **Medium Priority (ROI 5)** |
| **B6** | Blocking I/O in Celery Workers | Queue / Worker | **High** (Low throughput)| Medium / Low | **Medium Priority (ROI 6)** |

---

## 4. Expected Performance Gains

Applying these architectural optimizations will transform the performance profiles:

* **Response Latency:** Down from `8.5s - 15.0s` to **`1.8s - 3.5s`** for complete agent actions (primarily bounded by LLM inference speeds).
* **System Throughput:** Increase from `~50` concurrent conversations per server node to **`5,000+`** through async I/O, local CRM cache, and event-driven non-blocking design.
* **Infrastructure Costs:** Down by `40-60%` by eliminating large process-level pools and moving to lightweight greenlets (gevent) or async/await tasks.
