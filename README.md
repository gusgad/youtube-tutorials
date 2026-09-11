# ChatterBox

ChatterBox is a small team-chat application: workspaces, channels, real-time
messaging over WebSockets, unread badges, search, and async notification
delivery.

It is used as an **interview exercise**. The application runs end-to-end,
but it was shipped with a number of real, representative problems in it —
functional bugs, security vulnerabilities, performance issues, and
architectural weaknesses. Some are obvious from reading the code; some only
show up under load, at scale, or with a security-minded read. You're
encouraged to use whatever tools you'd normally use, AI assistants included.

## Stack

- **Backend**: Node.js / Express, Socket.IO, `pg` (PostgreSQL), `redis`, `amqplib` (RabbitMQ)
- **Frontend**: React + Vite
- **Datastores**: PostgreSQL, Redis
- **Messaging**: RabbitMQ (async notification delivery via a separate worker process)
- **Infra**: Dockerfiles + `docker-compose.yml` for local dev, Kubernetes manifests under `k8s/` for a (hypothetical) cluster deployment

## Architecture

```
                     ┌─────────────┐
                     │   frontend  │  React + Vite (browser)
                     └──────┬──────┘
                            │ HTTP + WebSocket
                     ┌──────▼──────┐        ┌───────────┐
                     │   backend   │───────▶│  postgres │
                     │  (Express + │        └───────────┘
                     │  Socket.IO) │        ┌───────────┐
                     │             │───────▶│   redis   │  (unread counts)
                     │             │        └───────────┘
                     │             │        ┌───────────┐
                     │             │───────▶│  rabbitmq │
                     └─────────────┘        └─────┬─────┘
                                                   │
                                          ┌────────▼────────┐
                                          │ notification     │
                                          │ worker (consumer)│
                                          └──────────────────┘
```

## Running it

### Option A: Docker Compose (recommended)

```
docker compose up --build
```

This starts Postgres, Redis, RabbitMQ, the backend API + WebSocket server,
the notification worker, and the frontend dev server.

On first boot, run the migration/seed script once the `postgres` container
is healthy:

```
docker compose exec backend npm run migrate
```

Then open http://localhost:5173. Demo accounts (password `password123`):

- alice@chatterbox.dev (workspace admin)
- bob@chatterbox.dev
- carol@chatterbox.dev

### Option B: Run natively

You'll need local Postgres, Redis, and RabbitMQ instances (or point the env
vars at remote ones). Copy `.env.example` to `.env` and fill it in, then:

```
cd backend && npm install && npm run migrate && npm run dev
# in another terminal
cd backend && npm run worker
# in another terminal
cd frontend && npm install && npm run dev
```

## Kubernetes manifests

`k8s/` contains manifests for a full deployment of this stack. They are not
meant to be applied to a real cluster as-is — review them as part of the
exercise.

## The exercise

Treat this like a codebase you've just inherited. There's no single "find
the bug" — instead:

1. **Debug**: something in here is broken or behaves incorrectly. Find it,
   explain the root cause, and fix it.
2. **Security review**: identify vulnerabilities you'd flag in a security
   review before this went to production, and fix at least one.
3. **Performance**: identify at least one thing that would fall over under
   real load (many users, many messages, many channels) and propose or
   implement a fix.
4. **Architecture**: this is meant to run as multiple replicas behind a
   load balancer / in Kubernetes. Does it actually work correctly that way?
   What would you change?

You're free to use AI tools for all of this — reading, debugging, patching,
and design discussion. Be ready to explain *why* something was wrong and
*why* your fix is correct, not just present a diff.

There is no requirement to fix everything. Depth on a few issues is worth
more than a shallow pass over many.
