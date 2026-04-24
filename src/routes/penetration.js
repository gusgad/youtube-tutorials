import { Router } from 'express'
import redis from '../redis.js'
import { fetchProduct } from '../db.js'

const router = Router()
const BLOOM_KEY = 'products:bloom'

// Seed Bloom filter with known valid IDs on startup
await redis.sendCommand(['BF.MADD', BLOOM_KEY, '1', '2', '42'])

// BAD: no null caching — every miss for ghost ID hits the DB
async function getProductUnsafe(id) {
  const cached = await redis.get(`product:${id}`)
  if (cached) return { source: 'cache', data: JSON.parse(cached) }

  const product = await fetchProduct(id)
  if (product) {
    await redis.set(`product:${id}`, JSON.stringify(product), { EX: 3600 })
  }
  // null result is not cached — next request will hit DB again
  return { source: 'db', data: product }
}

// GOOD: Bloom filter + null caching
async function getProductSafe(id) {
  // Step 1: Bloom filter check — if definitely not in DB, skip everything
  const mightExist = await redis.sendCommand(['BF.EXISTS', BLOOM_KEY, id])
  if (!mightExist) {
    return { source: 'bloom filter', data: null, note: 'definitely not in DB' }
  }

  // Step 2: Redis lookup
  const cached = await redis.get(`product:${id}`)
  if (cached === 'NULL') return { source: 'cache (null)', data: null }
  if (cached) return { source: 'cache', data: JSON.parse(cached) }

  // Step 3: DB lookup — cache the result either way
  const product = await fetchProduct(id)
  if (product) {
    await redis.set(`product:${id}`, JSON.stringify(product), { EX: 3600 })
  } else {
    await redis.set(`product:${id}`, 'NULL', { EX: 300 })  // short TTL for nulls
  }
  return { source: 'db', data: product }
}

router.get('/:id', async (req, res) => {
  const mode = req.query.mode ?? 'good'
  const { id } = req.params

  const result = mode === 'bad'
    ? await getProductUnsafe(id)
    : await getProductSafe(id)

  res.json({ mode, id, ...result })
})

export default router
