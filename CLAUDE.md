# CLAUDE.md

Context for Claude Code working in this repo.

## What this is

A demo project for a **sponsored long-form YouTube video** on the
Software Developer Diaries channel (audience: mid-to-senior developers,
distributed-systems leaning). Sponsor is **Honeycomb**, feature being
highlighted is **Agent Timeline**. Booked via the Freeman & Forrest
agency, brief ID 9713.

The code exists to be *filmed*, not shipped. That changes the priorities:

- **Legibility beats abstraction, even through the framework.** The model
  call and tool call go through LangChain.js (`@langchain/anthropic`'s
  `ChatAnthropic` + `.bindTools()`, `@langchain/core`'s `tool()`) rather
  than the raw Anthropic SDK, but the per-iteration agent loop itself is
  still hand-written in `agent_fleet_naive.js` / `agent_fleet_backoff.js` —
  no `AgentExecutor` or LangGraph runtime sitting between the model call
  and the tool call. Every decision point must still be visible on screen
  as a distinct line in the loop; don't collapse the loop into a prebuilt
  agent/executor abstraction. Running six of these loops concurrently
  doesn't change that rule.
- **Comments are script material.** The long docstrings explain *why*
  something is written the way it is. They are there for the video. Keep
  them.
- **The story must reproduce reliably.** Unlike a fully sequential demo,
  this one has genuine concurrency — six agents racing a shared gateway,
  with real network latency on every model call. Byte-identical timing
  across takes isn't achievable and isn't the goal. What must reproduce is
  the *shape* of the story: `agent_fleet_naive.js` reliably produces a
  first-wave pile of rejections and at least a couple of agents giving up;
  `agent_fleet_backoff.js` reliably produces a clean, mostly-or-fully
  successful run. Two structural choices make that reliable rather than
  lucky: `payment_gateway.js`'s capacity (2) is small relative to the
  fleet size (6), so the naive run's collisions are close to guaranteed by
  simple counting, not timing; and `jitter.js` uses a fixed-seed PRNG
  instead of `Math.random()`, so the backoff run's "random-looking" stagger
  and backoff delays are themselves reproducible. Verified empirically by
  running each script 3× before treating either as ready to film — do the
  same after any change to the timing constants, **including adding or
  removing a tool**: extra tools mean extra real model-call round trips
  before `charge_card` fires, which adds real-world latency variance that
  can quietly stagger the naive run's first wave on its own and undersell
  the collision. That's exactly what happened when `get_order` /
  `mark_order_paid` were added — `payment_gateway.js`'s `PROCESSING_MS`
  and `agent_fleet_backoff.js`'s stagger/backoff constants both had to be
  scaled up (roughly 3×) to keep both stories reliable again.

Treat the brief and campaign details as confidential (agency requirement).

Node.js/JavaScript, SQLite via the built-in `node:sqlite` module, no
Docker. `npm install` and a Node 22.5+ binary is the whole setup.
LangChain.js (`@langchain/anthropic`, `@langchain/core`) is a direct
dependency for the model/tool-calling layer; `zod` defines tool schemas.

## The thesis

This demo is about **durability and mission criticality in AI agents**,
not security. The premise: six ops agents, each handling one customer's
payment, all call the same rate-limited payments API at once. None of them
are doing anything unreasonable individually — retry-on-failure is
standard, expected behavior. But none of them know about the other five,
so their retries collide with each other, not just with the gateway. The
gateway's real capacity gets re-flooded on every retry wave, and agents
that exhaust their retry budget give up and fail their task outright — no
prompt injection, no adversarial input, no model failure. Every agent did
exactly what a reasonable retry policy tells it to do.

This is modeled directly on Honeycomb's own Agent Timeline launch example
(a tool that retries a rate-limited payments API and returns 502s,
surfaced by "Show Failures Only" with a trace waterfall connecting the
AI-layer retry decision to the infra error) — chosen specifically because
it's a failure category the product already detects and highlights today,
rather than a bespoke scenario Agent Timeline has no special handling for.

The fix is not "tell each agent to retry more carefully." It's
**coordinating the fleet's retry timing** so load spreads out instead of
arriving in synchronized bursts: the `charge_card` tool staggers each
agent's first attempt and backs off exponentially with jitter on retries,
invisibly to the model. The agent's behavior — and the system prompt — do
not change at all between the naive and fixed versions. Only the tool
implementation does. That is the argument: reliability guarantees belong
in the architecture the agents call into, not in the prompt telling each
one individually to be careful.

**Honest caveat that must survive any edit:** staggered backoff reduces
contention, it doesn't eliminate it — with enough concurrent agents or a
low enough gateway capacity, collisions are still possible even in the
"fixed" run. Don't let a refactor imply this is a guarantee rather than a
large reduction in collision probability.

## The two runs

Filmed back to back. Same model, same system prompt, same task shape
(one agent per order), same rate-limited gateway — only the tool's retry
timing strategy differs.

| File | Argument it makes | What the timeline shows |
|---|---|---|
| `agent_fleet_naive.js` | Six agents retrying independently, with no awareness of each other, re-flood a gateway that can only handle 2 concurrent charges. Some agents exhaust their retry budget and fail outright. | Six swim lanes (one per `gen_ai.agent.name`) under one shared conversation ID. "Show Failures Only" lights up a first-wave cluster of `gateway_attempt` spans marked ERROR (502/overloaded), and several agents' conversations end in ERROR because they gave up. |
| `agent_fleet_backoff.js` | The identical fleet, once the tool layer staggers first attempts and backs off with jitter on retries, spreads its load out instead of bursting — most or all agents complete cleanly. | Same six swim lanes, same shared conversation ID, but far fewer (often zero) `gateway_attempt` spans marked ERROR, and the conversations end in success. |

## Architecture

```
6 concurrent agents ──get_order────────────────────────────────> orders.js ──────┐
   (Promise.all)     ──charge_card(order_id, amount_cents)──> payment_gateway.js ├──> SQLite (appdb.sqlite)
                      ──mark_order_paid──────────────────────────> orders.js ────┘
                                                                        │
                                                                        └──> OTLP ──> Honeycomb Agent Timeline
```

- `otel_setup.js` — shared OTel bootstrap, OTLP/HTTP straight to
  Honeycomb. No vendor SDK: standard `gen_ai.*` semantic conventions
  only. This is deliberate and is an on-camera talking point about
  portability.
- `db.js` + `seed.sql` — local database. `db.js` opens (and auto-seeds
  on first run) a plain SQLite file, `appdb.sqlite`, next to the scripts.
  `seed.sql` seeds six pending orders (one per fleet agent) and `charges`,
  the ledger of money that actually moved — the source of truth for
  whether an order got charged, written by the gateway simulator
  (`payment_gateway.js`), not by the agents directly.
- `orders.js` — our own order records, read by `get_order` and written by
  `mark_order_paid`. Unlike `payment_gateway.js`, these calls only ever
  touch our own database and never fail — deliberately, so the demo's one
  unreliable dependency stays isolated to the gateway call and doesn't get
  diluted across multiple flaky tools.
- `payment_gateway.js` — the simulated external payment processor. See
  its module docstring for exactly how and why it caps concurrent
  in-flight charges and rejects the rest with a simulated 502
  (`GatewayOverloadedError`) rather than partially processing them. This
  file has no OTel instrumentation of its own — it's a stand-in for a
  real third-party API the agents don't control and can't instrument.
- `jitter.js` — fixed-seed PRNG (mulberry32), used only by
  `agent_fleet_backoff.js`. See its docstring for why this is a
  deliberate, documented exception to "no randomness": jitter is what
  makes backoff actually work, and a seeded PRNG gives jitter that looks
  organic on screen but reproduces identically take to take.
- `genai_messages.js` — maps LangChain message objects to the GenAI
  semantic conventions' `gen_ai.input.messages` / `gen_ai.output.messages`
  JSON shape. Shared by both fleet scripts so Agent Timeline can show full
  message content, not just span metadata.
- `agent_fleet_naive.js` / `agent_fleet_backoff.js` — the two runs. Each
  spins up six independent agents (one LangChain `ChatAnthropic` bound to
  three tools — `get_order`, `charge_card`, `mark_order_paid` — per
  order) and runs them concurrently via `Promise.all`. Every agent's loop
  is the same hand-written `model.invoke(messages)` → check
  `response.tool_calls` → invoke the tool → push the resulting
  `ToolMessage` → repeat shape as before. The expected sequence per agent
  is look up the order, charge it, mark it paid — but only `charge_card`
  owns a retry loop against the gateway (up to `MAX_ATTEMPTS`), so from
  the model's perspective that one tool call resolves to either a success
  or a clear "gave up" result; `get_order` and `mark_order_paid` are
  always single-shot. All six agents share one `gen_ai.conversation.id`;
  each has its own `gen_ai.agent.name` — that combination is what drives
  Agent Timeline's multi-agent swim lanes.

## Instrumentation conventions

Always emit on every tool span (`get_order`, `charge_card`,
`mark_order_paid`) and on `charge_card`'s nested `gateway_attempt` spans:

- `gen_ai.conversation.id` — **load-bearing.** Shared across all six
  agents in a run; this is what groups them into one investigable unit
  in Agent Timeline.
- `gen_ai.agent.name` — **load-bearing.** Distinct per agent
  (`payments-ops-fleet-<order_id>`); this is what drives the multi-agent
  swim lanes within that shared conversation.
- `gen_ai.operation.name`, `gen_ai.tool.name`
- `tool.input.*` and `tool.output.*` (e.g. `get_order` sets
  `tool.output.status` / `tool.output.amount_cents` / `tool.output.found`)

`model_call` spans additionally carry `gen_ai.input.messages` /
`gen_ai.output.messages` (JSON strings, per the GenAI semconv's message
schema) so Agent Timeline renders actual conversation content instead of
just "a model call happened here." `genai_messages.js` maps LangChain's
message objects (`SystemMessage`/`HumanMessage`/`AIMessage`/`ToolMessage`)
into that schema — role + `parts` (`text` / `tool_call` /
`tool_call_response`) for input, plus `finish_reason` on output. This
schema is still Development status upstream (not Stable) as of 2026; if
it changes, re-check `genai_messages.js` against
github.com/open-telemetry/semantic-conventions-genai.

`model_call` spans also carry `gen_ai.usage.input_tokens` /
`gen_ai.usage.output_tokens`, read straight off LangChain's
`response.usage_metadata` (no mapping needed — the field names already
match the semconv attribute names) — this is what makes token usage show
up in Agent Timeline's Gen AI tab.

Durability-specific custom attributes (queryable, and the basis for the
detection story): `payment.gateway_attempt_outcome` (`success` /
`overloaded`, set per `gateway_attempt` span), `payment.retry_attempt`,
`payment.gave_up` and `payment.attempts_used` (set on the `charge_card`
span and mirrored onto that agent's `agent_conversation` span once the
run completes).

**Errors must set span status explicitly:**
`span.setStatus({ code: SpanStatusCode.ERROR, message: reason })`. Every
`overloaded` (502) `gateway_attempt` is a real error and must render as
one in the timeline. An agent's `agent_conversation` span is marked ERROR
separately whenever that agent gave up without charging its order — that
is the actual incident, and it is conversation-level, not single-span.

## Running

Requires Node.js 22.5+ (for the built-in `node:sqlite` module).

```bash
npm install

export ANTHROPIC_API_KEY=...
export HONEYCOMB_API_KEY=...
export HONEYCOMB_DATASET=confused-deputy-demo
# or: cp .env.example .env, fill it in, and pass --env-file=.env below

node --env-file=.env agent_fleet_naive.js
node --env-file=.env agent_fleet_backoff.js
```

Reset between takes: `rm appdb.sqlite` (it is recreated and reseeded with
six fresh pending orders automatically on the next run).

Each run prints a per-order summary (charged or not, order status, and
how many charges were recorded), a fleet-wide tally of charged vs.
gave-up, and a conversation ID — paste the ID into Agent Timeline. The
naive run finishes in well under 30 seconds; the backoff run deliberately
staggers agents over a much wider window (tens of seconds) to keep
collisions rare, so expect it to take noticeably longer end to end.

## Deliverables and dates

Sponsor requirements: FTC disclosure, emphasise OpenTelemetry GenAI
Semantic Conventions, state Agent Timeline is free, CTA link
https://fandf.co/4z1DWJV, tag @honeycombio. Do not feature Datadog or
Dynatrace.

- Script outline: **Aug 11, 2026**
- Draft: **Aug 14, 2026**
- Go live: **Aug 20, 2026**
- Metrics at +7 days (Aug 27) and +30 days (Sep 19)

## Open work

- [x] ~~Decide whether to add a second, lightweight agent... to exercise
      Agent Timeline's multi-agent swim-lane view.~~ Resolved by the pivot
      to a six-agent fleet — swim lanes are now central to the demo.
- [ ] The 20-title brainstorm and the sponsor content-overview text were
      both written for the old idempotency/duplicate-charge framing and
      are now stale. Need a fresh pass once this demo is confirmed
      reading well in Honeycomb.
- [ ] `agent_chat.js` (interactive terminal REPL) was deleted along with
      the old idempotency demo it was built around. Could be rebuilt
      against the fleet gateway if an interactive/exploratory mode is
      wanted again — not needed for filming either way.
- [ ] Record final title chosen for A/B testing.
