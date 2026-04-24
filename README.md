# Caching is Hard — Interactive Demo

A hands-on Node.js + Redis app demonstrating the five hardest caching problems and their solutions.

## Prerequisites

- Docker & Docker Compose
- Node.js 18+

## Quick Start

### 1. Start Redis

```bash
docker compose up -d
```

Verify it's running:
```bash
redis-cli ping
# Expected: PONG
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run the Server

```bash
npm start
# or with auto-reload:
npm run dev
```

Server runs on **http://localhost:3000**

RedisInsight UI available at **http://localhost:8001** for live key inspection.

---

## API Endpoints

All endpoints support `?mode=bad` and `?mode=good` query parameters to toggle between broken and fixed implementations.

### 1. **Thundering Herd**
`GET /thundering-herd`

**Problem:** Multiple concurrent cache misses hit the database simultaneously.

**Solution:** Mutex lock — only one request rebuilds the cache, others wait.

```bash
# Broken implementation (all requests hit DB)
curl "http://localhost:3000/thundering-herd?mode=bad"

# Fixed implementation (only first request hits DB)
curl "http://localhost:3000/thundering-herd?mode=good"
```

**Query Parameters:**
- `mode`: `bad` or `good` (default: `good`)
- `id`: product ID (default: `1`)

---

### 2. **Cache Penetration**
`GET /penetration/:id`

**Problem:** Requests for non-existent items bypass the cache every time.

**Solution:** Bloom filter to reject impossible lookups + null caching for real misses.

```bash
# Broken (every request for ghost IDs hits DB)
curl "http://localhost:3000/penetration/999999?mode=bad"

# Fixed (Bloom filter blocks impossible IDs before DB)
curl "http://localhost:3000/penetration/999999?mode=good"

# Real misses are cached with short TTL
curl "http://localhost:3000/penetration/1?mode=good"
```

**Query Parameters:**
- `mode`: `bad` or `good` (default: `good`)

**Valid IDs:** `1`, `2`, `42`

---

### 3. **Cache Breakdown**
`GET /breakdown`

**Problem:** A cache with a TTL expires, causing a sudden spike when all requests hit the database.

**Solution:** Remove the TTL — let the key live forever and invalidate only on writes.

```bash
# Broken (10s TTL means simultaneous expiry spike)
curl "http://localhost:3000/breakdown?mode=bad"

# Fixed (no TTL, invalidated only on updates)
curl "http://localhost:3000/breakdown?mode=good"

# Invalidate cache manually
curl -X POST "http://localhost:3000/breakdown/invalidate"
```

**Query Parameters:**
- `mode`: `bad` or `good` (default: `good`)

Response includes `ttl` field showing the remaining seconds.

---

### 4. **Cache Avalanche**
`GET /avalanche/load`

**Problem:** Multiple keys with the same TTL expire simultaneously, overwhelming the database.

**Solution:** Jittered TTL — spread expiry across a window.

```bash
# Load keys with broken pattern (all expire at once)
curl "http://localhost:3000/avalanche/load?mode=bad"

# Load keys with jittered TTL (spread expiry)
curl "http://localhost:3000/avalanche/load?mode=good"

# Check how many keys are alive
curl "http://localhost:3000/avalanche/stats"
```

**Endpoints:**
- `GET /avalanche/load` — Load 50 test keys with broken or jittered TTL
- `GET /avalanche/stats` — Show live vs expired keys

**Query Parameters:**
- `mode`: `bad` or `good` (default: `good`)

---

### 5. **Hot Key**
`GET /hotkey`

**Problem:** A viral product creates a traffic hotspot — one cache key on one shard gets slammed.

**Solution:** Replicate the key across 5 shards — distribute reads.

```bash
# Broken (all reads hit the same hot key)
curl "http://localhost:3000/hotkey?mode=bad"

# Fixed (reads distributed across 5 replica keys)
curl "http://localhost:3000/hotkey?mode=good"
```

**Query Parameters:**
- `mode`: `bad` or `good` (default: `good`)

Response shows which replica was hit.

---

## Architecture

- **src/index.js** — Express app with route mounting
- **src/redis.js** — Official Redis client (node-redis)
- **src/db.js** — Simulated database with 200ms latency
- **src/routes/** — Five problem demonstrations

## Monitoring

### Watch Redis Keys in Real-Time

```bash
redis-cli MONITOR
```

### Check Cache Hit/Miss in Response

Every endpoint returns:
```json
{
  "source": "cache|db|bloom filter|cache (after wait)|...",
  "data": { ... }
}
```

The `source` field shows where the data came from — instant feedback on cache performance.

## Project Layout

```
caching-is-hard/
├── CLAUDE.md              # Original specification
├── docker-compose.yml     # Redis container
├── package.json
├── README.md              # This file
└── src/
    ├── index.js
    ├── redis.js
    ├── db.js
    └── routes/
        ├── thunderingHerd.js
        ├── penetration.js
        ├── breakdown.js
        ├── avalanche.js
        └── hotkey.js
```

## Key Takeaways

| Problem | Cause | Fix |
|---------|-------|-----|
| **Thundering Herd** | Multiple misses hit DB simultaneously | Mutex lock on the rebuild |
| **Cache Penetration** | Non-existent items bypass cache | Bloom filter + null cache |
| **Cache Breakdown** | TTL expiry causes spike | Remove TTL, invalidate on writes |
| **Cache Avalanche** | Same TTL = simultaneous expiry | Jittered TTL across window |
| **Hot Key** | Viral item floods one shard | Replicate across multiple keys |

## Troubleshooting

**Redis won't start:**
```bash
docker compose down
docker compose up -d
```

**npm install fails:**
```bash
rm -rf node_modules package-lock.json
npm install
```

**Port 3000 already in use:**
Edit `src/index.js` and change the port number.

**Redis connection refused:**
Ensure Redis is running: `redis-cli ping` should return `PONG`.
