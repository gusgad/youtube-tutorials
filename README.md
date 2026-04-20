# AI-Era Backend Architecture

A distributed backend demonstrating how modern AI-era backends differ from traditional microservices. The architecture splits the agent runtime into a separate Python microservice (idiomatic for AI workloads), while the API gateway and microservices stay in Node.js.

Two parallel request paths run through the system:

- **Direct path**: `Client → API Gateway (Node) → Microservice → Response`
- **AI path**: `Client → API Gateway (Node) → AI Gateway → Agent Service (Python) → Tool Layer → Microservice → Response`

## Quick start

### 1. Install Node.js dependencies

```bash
npm install
```

### 2. Install Python agent service dependencies

```bash
cd agent-service
pip install -r requirements.txt
cd ..
```

### 3. Run both services

**Terminal 1 — Python agent service:**
```bash
cd agent-service
python server.py
```

**Terminal 2 — Node.js backend (gateway + microservices):**
```bash
npm start
```

The API gateway listens on **port 3000**. The Python agent service listens on **port 4000**. Microservices run on ports 3001–3003.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | _(unset)_ | Set to use Claude. If unset, both Node and Python services run in mock mode. |
| `TOKEN_LIMIT` | `4000` | Max estimated tokens the AI gateway will accept per request. |
| `AGENT_MAX_STEPS` | `5` | Max ReAct loop iterations before the agent stops. |
| `AGENT_SERVICE_URL` | `http://localhost:4000` | URL of the Python agent service (used by AI gateway). |

## Example requests

All requests require an `Authorization: Bearer <token>` header (any non-empty token works).

### Direct path — bypasses AI entirely

```bash
# Get all orders
curl -H "Authorization: Bearer demo" http://localhost:3000/orders

# Get all users
curl -H "Authorization: Bearer demo" http://localhost:3000/users

# Create a payment
curl -X POST http://localhost:3000/payments \
  -H "Authorization: Bearer demo" \
  -H "Content-Type: application/json" \
  -d '{ "amount": 50, "from": "alice", "to": "bob" }'
```

### AI path — full stack, returns task_id immediately (202)

```bash
# Submit a natural-language query
curl -X POST http://localhost:3000/agent/query \
  -H "Authorization: Bearer demo" \
  -H "Content-Type: application/json" \
  -d '{ "prompt": "Get me all orders and tell me how many there are" }'

# Response: { "task_id": "<uuid>", "status": "accepted" }

# Poll for the result
curl -H "Authorization: Bearer demo" http://localhost:3000/tasks/<task_id>
```

## Architecture layers

| Layer | Language | Location | Port | Purpose |
|---|---|---|---|---|
| API Gateway | Node.js | `gateway/index.js` | 3000 | Single entry point, routing, auth, rate limiting |
| AI Gateway | Node.js | `ai-gateway/index.js` | — | Token budget enforcement, logging, calls Python agent |
| Agent Runtime | **Python** | `agent-service/runtime.py` | 4000 | ReAct loop, session state, LLM interaction via Claude |
| Tool Layer | **Python** | `agent-service/tools.py` | — | Wraps microservices as callable tools (MCP pattern) |
| Orders Service | Node.js | `services/orders.js` | 3001 | Returns hardcoded orders |
| Users Service | Node.js | `services/users.js` | 3002 | Returns hardcoded users |
| Payments Service | Node.js | `services/payments.js` | 3003 | Accepts payment and returns confirmation |
| Event Bus | Node.js | `events/bus.js` | — | In-process pub/sub for task lifecycle events |

## Key behaviours

1. **Routing split** — `GET /orders` hits the microservice directly. `POST /agent/query` goes through the full AI pipeline (Python agent service).
2. **Ack early** — AI requests return `202 Accepted` with a `task_id` immediately. Poll `GET /tasks/:task_id` for the result.
3. **Tool isolation** — The Python agent runtime only reaches microservices through the tool layer, never via direct calls.
4. **Event visibility** — Every agent task produces `task.started` and `task.completed` (or `task.failed`) console log lines from the event bus.
5. **Language split** — API layer stays in Node.js (fast, minimal overhead), AI layer moves to Python (idiomatic for agents, better libraries).
