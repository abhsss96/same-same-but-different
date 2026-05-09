# Phoenix LiveView vs Rails Hotwire

> Source for the blog post: *"Phoenix LiveView vs Rails Hotwire: What I learned building the same app twice."*

Two identical collaborative todo boards, one in each stack. Same features, same HTML structure, same Tailwind classes. Different everything underneath.

```
phoenix_app/   Phoenix 1.7 · LiveView · Ecto · PostgreSQL · Bandit
rails_app/     Rails 8 · Turbo Streams · Stimulus · Action Cable · PostgreSQL · Puma
bench/         k6 HTTP + WebSocket scripts · Node.js flood script
shared/        architecture diagram (see below)
```

---

## Architecture

```
┌──────────────────────────────┐    ┌──────────────────────────────────────┐
│       Phoenix LiveView        │    │         Rails 8 + Hotwire             │
│                              │    │                                        │
│  Browser                     │    │  Browser                               │
│   └─ 1 WebSocket ────────────┼──  │   ├─ WS #1: Turbo::StreamsChannel ───┐ │
│       ├─ LiveView process     │    │   │   (todo HTML diffs)               │ │
│       │   ├─ Presence.track  │    │   └─ WS #2: RoomChannel ─────────────┤ │
│       │   ├─ PubSub.subscribe│    │       (presence + typing JSON)        │ │
│       │   └─ handle_event    │    │                                        │ │
│       └─ PubSub (Erlang) ────┤    │  HTTP POST/PATCH/DELETE ──────────────┤ │
│           ├─ presence_diff   │    │   └─ TodosController                   │ │
│           ├─ todo_created    │    │       └─ broadcasts Turbo Stream ──────┘ │
│           └─ todo_updated    │    │                                        │
│                              │    │  PostgreSQL ← todos table              │
│  PostgreSQL ← todos table    │    │  RoomPresence ← in-memory Mutex+Hash  │
│  Phoenix.Presence ← CRDT     │    │    (Redis/pg LISTEN in production)    │
└──────────────────────────────┘    └──────────────────────────────────────┘
```

**Key architectural differences documented in code comments:**

| What | Phoenix | Rails |
|---|---|---|
| WebSocket connections per tab | **1** (LiveView) | **2** (StreamsChannel + RoomChannel) |
| CRUD transport | WebSocket (`phx-submit`) | HTTP POST → Turbo Stream |
| Presence | `Phoenix.Presence` CRDT, built-in | Custom `RoomPresence` Mutex+Hash |
| Typing indicator | Presence metadata update | Separate cable message |
| Server state | LiveView process assigns | DB + client DOM (stateless server) |
| JS for real-time | None (0 lines) | 3 Stimulus controllers (~200 lines) |

---

## Setup

### Prerequisites

```bash
# All tool versions are pinned in .tool-versions
asdf install
```

You need PostgreSQL running locally with a `postgres` superuser (default on macOS via `brew services start postgresql@16`).

### Phoenix

```bash
cd phoenix_app

# First run only
mix setup          # deps.get + ecto.create + migrate

# Start dev server
mix phx.server
# → http://localhost:4000
```

### Rails

```bash
cd rails_app

# First run only
bundle install
bin/rails db:create db:migrate

# Start dev server (Rails + Tailwind watcher)
bin/dev
# → http://localhost:3000
```

---

## Features

- **Collaborative todo board** — share the URL, everyone joins the same room
- **Live presence** — colored avatar for each connected user, updated in real time
- **Typing indicator** — `[Name] is typing…` shown to all other clients
- **Toggle / edit / delete** — broadcast to all connected clients instantly
- **Stress test page** — `/stress` — in-browser latency probe + links to k6 scripts

---

## Benchmarks

### Running

```bash
# Install k6: brew install k6
# Install ws:  cd bench && npm install ws

# HTTP throughput
k6 run bench/k6_http.js --env TARGET=phoenix
k6 run bench/k6_http.js --env TARGET=rails

# WebSocket connection scaling
k6 run bench/k6_ws.js --env TARGET=phoenix
k6 run bench/k6_ws.js --env TARGET=rails

# Raw WebSocket flood (Node.js)
node bench/ws_flood.js --target phoenix --conns 1000
node bench/ws_flood.js --target rails   --conns 1000
```

Results are saved to `bench/results/`.

### Results Table

> Numbers to be filled in after running benchmarks on identical hardware (Docker containers).

| Metric | Phoenix LiveView | Rails Hotwire |
|---|---|---|
| LOC (app code, excl. generated) | — | — |
| Lines of config | — | — |
| Time to first broadcast (ms) | — | — |
| HTTP p50 latency (ms) | — | — |
| HTTP p95 latency (ms) | — | — |
| HTTP p99 latency (ms) | — | — |
| WS p50 connect time (ms) | — | — |
| WS p95 connect time (ms) | — | — |
| WS p99 connect time (ms) | — | — |
| Max concurrent WS connections | — | — |
| RAM baseline (MB) | — | — |
| RAM at 1 000 connections (MB) | — | — |
| RAM at 5 000 connections (MB) | — | — |
| WebSocket handshakes/sec (peak) | — | — |

### Counting LOC

```bash
# Phoenix app code (excludes generated boilerplate + assets)
find phoenix_app/lib -name "*.ex" -o -name "*.heex" | xargs wc -l

# Rails app code (excludes generated boilerplate + assets)
find rails_app/app -name "*.rb" -o -name "*.erb" -o -name "*_controller.js" | xargs wc -l
```

---

## Docker

Each app has a `Dockerfile` so you can run benchmarks in equivalent containers.

```bash
# Build
docker build -t todo_phoenix ./phoenix_app
docker build -t todo_rails   ./rails_app

# Run (set real creds)
docker run -e DATABASE_URL=postgresql://postgres:postgres@host.docker.internal/todo_board_prod \
           -e SECRET_KEY_BASE=$(openssl rand -hex 64) \
           -p 4000:4000 todo_phoenix

docker run -e DATABASE_URL=postgresql://postgres:postgres@host.docker.internal/rails_app_production \
           -e SECRET_KEY_BASE=$(openssl rand -hex 64) \
           -e RAILS_ENV=production \
           -p 3000:3000 todo_rails
```

---

## Key Divergences (blog post material)

### 1. Number of WebSocket connections per browser tab

**Phoenix** opens **one** WebSocket. It carries presence diffs, todo broadcasts, typing events, and LiveView DOM patches — all multiplexed over a single connection managed by the Erlang VM.

**Rails** opens **two** Action Cable connections: one to `Turbo::StreamsChannel` (subscribed via `<%= turbo_stream_from ... %>`) for HTML diffs, and one to the custom `RoomChannel` for JSON presence/typing events.

### 2. Presence: built-in vs hand-rolled

**Phoenix** ships `Phoenix.Presence`, a CRDT-based distributed presence system. Calling `Presence.track/4` is all that's needed. It handles multi-node conflicts, process monitoring, and automatic cleanup when a process dies.

**Rails** has nothing in core. `rails_app/lib/room_presence.rb` is ~50 lines of Mutex+Hash that works only within a single Puma process. Production use requires Redis (or Postgres LISTEN/NOTIFY) — and manual integration code.

### 3. CRUD transport

**Phoenix** sends every user action (add, toggle, edit, delete) over the existing LiveView WebSocket via `phx-submit` and `phx-click`. No HTTP endpoints needed.

**Rails** sends CRUD over HTTP POST/PATCH/DELETE. The controller saves to the DB, then calls `Turbo::StreamsChannel.broadcast_*_to` to push Turbo Stream updates to other clients. This is the classic Hotwire pattern and works well, but it means every mutation involves an HTTP round-trip plus a separate WebSocket broadcast.

### 4. Server state vs stateless

**Phoenix LiveView** is a stateful server process. The full list of todos and presences lives in the LiveView process's `assigns`. The process is also the subscription holder for PubSub.

**Rails** is stateless. The controller reads from the DB on every request. The DOM in the browser is the source of truth between requests. Turbo keeps it updated, but there's no server-side "current state" for a connected client.

### 5. JavaScript

**Phoenix**: 0 lines of application JavaScript needed for real-time features. The 20-line `app.js` hook is only for the stress-test latency probe.

**Rails**: ~200 lines of Stimulus controllers (`room_controller.js`, `todo_controller.js`, `todo_form_controller.js`) for presence DOM updates, form handling, and inline editing. This is not a criticism — Stimulus is intentionally minimal — but it is more surface area.

---

## Room URLs

Both apps use identical URL schemes:

| URL | Description |
|---|---|
| `/` | Redirects to `/room/lobby` |
| `/room/:id` | Collaborative todo board for room `:id` |
| `/stress` | In-browser stress test + k6 command reference |

---

## License

MIT
