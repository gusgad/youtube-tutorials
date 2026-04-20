# AI-Era Backend Architecture — Implementation Brief

## What to build

A Node.js backend that demonstrates how modern AI-era backends differ from traditional microservices. The goal is a working scaffold that clearly shows the new layers alongside the unchanged ones.

---

## Architecture overview

The backend has two parallel paths through it, decided at the API gateway:

**Direct path** (unchanged from traditional microservices):
`Client → API Gateway → Microservice → Database`

**AI path** (new):
`Client → API Gateway → AI Gateway → Agent Runtime → Tool Layer (MCP) → Microservice → Database`

The API gateway inspects each request and routes it based on whether it needs intelligence or not.

---

## Layer breakdown

### 1. API Gateway
- Single entry point on port 3000
- Routes `GET /orders`, `GET /users`, `POST /payments` directly to the relevant microservice — no AI involved
- Routes `POST /agent/query` to the AI gateway when the request contains a natural language `prompt` field
- Standard concerns: basic auth header check, rate limiting (simple in-memory counter is fine), request logging

### 2. Microservices (3 simple services)
- **Orders service** (port 3001): `GET /orders` returns a hardcoded list of orders
- **Users service** (port 3002): `GET /users` returns a hardcoded list of users
- **Payments service** (port 3003): `POST /payments` accepts a body and returns a confirmation

These are intentionally thin — they represent existing services that are unchanged by the AI layer.

### 3. AI Gateway
- Sits between the API gateway and agent runtime
- Enforces a token budget: reject requests where estimated prompt tokens exceed a configured limit (e.g. 4000)
- Logs every request with timestamp, model used, and estimated token count
- Simple provider routing: uses Anthropic Claude by default, falls back to a mock if no API key is set
- Does NOT do the reasoning itself — just governs and forwards to the agent runtime

### 4. Agent Runtime
- Receives a `{ prompt, context }` payload
- Uses a simple ReAct loop: reason about what tools to call, call them via the tool layer, observe results, repeat until done
- Has a configurable max steps limit (default: 5) to prevent runaway loops
- Maintains session state in memory (a simple Map keyed by session_id) during a single run
- Returns a structured result: `{ answer, steps_taken, tools_called }`

### 5. Tool Layer
- Wraps the three microservices as callable tools the agent can invoke by name
- Each tool has: a name, a description the agent uses to decide when to call it, and an execute function
- Available tools:
  - `get_orders` — calls the Orders service
  - `get_users` — calls the Users service
  - `create_payment` — calls the Payments service
- This is the MCP concept simplified: the agent never calls microservices directly, only through this layer

### 6. Event Bus (simple in-process pub/sub)
- A lightweight EventEmitter-based bus (no Kafka needed for the scaffold)
- The agent runtime publishes three event types:
  - `task.started` — emitted when the agent begins processing, includes session_id and prompt
  - `task.completed` — emitted when done, includes session_id, answer, and tools_called
  - `task.failed` — emitted on error, includes session_id and error message
- A subscriber logs all events to console with timestamps
- Each event payload includes a `task_id` for idempotency

---

## Key behaviours to demonstrate

1. **Routing split**: `GET /orders` should bypass all AI layers entirely. `POST /agent/query` with `{ "prompt": "show me all orders" }` should go through the full AI path.

2. **Ack early pattern**: When the API gateway receives an AI path request, it returns `{ task_id, status: "accepted" }` immediately (202 response) and processes asynchronously. The client can poll `GET /tasks/:task_id` for the result.

3. **Tool layer isolation**: The agent runtime must only reach microservices via the tool layer — no direct HTTP calls from within the reasoning loop.

4. **Event visibility**: Every agent task should produce at least two console log lines from the event bus subscriber showing task.started and task.completed (or task.failed).

---

## Project structure

```
ai-era-backend/
├── gateway/
│   └── index.js          # API gateway — routing logic
├── ai-gateway/
│   └── index.js          # Token budget, logging, provider routing
├── agent/
│   ├── runtime.js        # ReAct loop, session state
│   └── tools.js          # Tool definitions wrapping microservices
├── services/
│   ├── orders.js         # Orders microservice
│   ├── users.js          # Users microservice
│   └── payments.js       # Payments microservice
├── events/
│   └── bus.js            # In-process event bus
├── package.json
└── README.md             # How to run, example curl commands for both paths
```

---

## Tech stack

- Node.js with ES modules
- Express for HTTP
- Node's built-in `EventEmitter` for the event bus
- `node-fetch` or native `fetch` for inter-service calls
- Anthropic SDK for the agent runtime (fall back to a mock response if `ANTHROPIC_API_KEY` is not set)

---

## Example requests to demonstrate both paths

```bash
# Direct path — bypasses AI entirely
curl http://localhost:3000/orders

# AI path — goes through full stack, returns task_id immediately
curl -X POST http://localhost:3000/agent/query \
  -H "Content-Type: application/json" \
  -d '{ "prompt": "Get me all orders and tell me how many there are" }'

# Poll for result
curl http://localhost:3000/tasks/{task_id}
```

---

## What NOT to build

- No authentication beyond a basic header check
- No database — hardcoded data in services is fine
- No Docker or deployment config
- No frontend
- No real Kafka/RabbitMQ — the in-process EventEmitter is sufficient to show the pattern

The goal is clarity of architecture, not production readiness.
