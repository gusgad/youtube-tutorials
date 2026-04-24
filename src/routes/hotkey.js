import { Router } from 'express'
import redis from '../redis.js'

const router = Router()
const REPLICAS = 5
const KEY = 'product:viral'

// BAD: all traffic to a single key on a single node
async function getHotKeyUnsafe() {
  const cached = await redis.get(KEY)
  if (cached) return { source: `cache (${KEY})`, data: JSON.parse(cached) }

  const data = { id: '42', name: 'Viral Product', price: 999.99 }
  await redis.set(KEY, JSON.stringify(data), { EX: 60 })
  return { source: 'db', data }
}

// GOOD: replicate across N keys — reads distributed across shards
async function getHotKeySafe() {
  const replica = Math.floor(Math.random() * REPLICAS)
  const replicaKey = `${KEY}:replica:${replica}`

  const cached = await redis.get(replicaKey)
  if (cached) return { source: `cache (${replicaKey})`, data: JSON.parse(cached) }

  const data = { id: '42', name: 'Viral Product', price: 999.99 }

  // Populate all replicas
  const promises = []
  for (let i = 0; i < REPLICAS; i++) {
    promises.push(
      redis.set(`${KEY}:replica:${i}`, JSON.stringify(data), {
        EX: 60,
      })
    )
  }
  await Promise.all(promises)

  return { source: 'db → all replicas populated', data }
}

router.get('/', async (req, res) => {
  const mode = req.query.mode ?? 'good'
  const result = mode === 'bad'
    ? await getHotKeyUnsafe()
    : await getHotKeySafe()

  res.json({ mode, replicas: REPLICAS, ...result })
})

export default router
