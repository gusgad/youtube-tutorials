import { Router } from 'express'
import redis from '../redis.js'
import { fetchProduct } from '../db.js'

const router = Router()

// BAD: no protection — every concurrent miss hits the DB
async function getProductUnsafe(id) {
  const cached = await redis.get(`product:${id}`)
  if (cached) return { source: 'cache', data: JSON.parse(cached) }

  const product = await fetchProduct(id)
  await redis.set(`product:${id}`, JSON.stringify(product), { EX: 10 })
  return { source: 'db', data: product }
}

// GOOD: mutex lock — only one request rebuilds, others wait
async function getProductSafe(id) {
  const cached = await redis.get(`product:${id}`)
  if (cached) return { source: 'cache', data: JSON.parse(cached) }

  const lockKey = `lock:product:${id}`
  const lockAcquired = await redis.set(lockKey, '1', { NX: true, EX: 5 })

  if (lockAcquired) {
    try {
      const product = await fetchProduct(id)
      await redis.set(`product:${id}`, JSON.stringify(product), { EX: 10 })
      return { source: 'db (lock holder)', data: product }
    } finally {
      await redis.del(lockKey)
    }
  } else {
    // Not the lock holder — wait briefly and retry
    await new Promise(r => setTimeout(r, 50))
    const cached = await redis.get(`product:${id}`)
    return { source: 'cache (after wait)', data: JSON.parse(cached) }
  }
}

router.get('/', async (req, res) => {
  const mode = req.query.mode ?? 'good'
  const id = req.query.id ?? '1'

  // Expire the key first so every demo hit starts cold
  await redis.del(`product:${id}`)

  const result = mode === 'bad'
    ? await getProductUnsafe(id)
    : await getProductSafe(id)

  res.json({ mode, ...result })
})

export default router
