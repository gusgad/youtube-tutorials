import { Router } from 'express'
import redis from '../redis.js'

const router = Router()
const KEY_COUNT = 50

// BAD: all keys get the same TTL — they all expire simultaneously
async function loadKeysBad() {
  const promises = []
  for (let i = 0; i < KEY_COUNT; i++) {
    promises.push(
      redis.set(`avalanche:product:${i}`, JSON.stringify({ id: i }), {
        EX: 20,
      })
    )
  }
  await Promise.all(promises)
  return { loaded: KEY_COUNT, ttl: '20s for all — they all expire together' }
}

// GOOD: jittered TTL — expiry spread across a window
async function loadKeysGood() {
  const promises = []
  for (let i = 0; i < KEY_COUNT; i++) {
    const jitter = Math.floor(Math.random() * 10)  // 0–10s jitter
    promises.push(
      redis.set(`avalanche:product:${i}`, JSON.stringify({ id: i }), {
        EX: 20 + jitter,
      })
    )
  }
  await Promise.all(promises)
  return { loaded: KEY_COUNT, ttl: '20–30s spread — expiry distributed' }
}

router.get('/load', async (req, res) => {
  const mode = req.query.mode ?? 'good'
  const result = mode === 'bad' ? await loadKeysBad() : await loadKeysGood()
  res.json({ mode, ...result })
})

router.get('/stats', async (req, res) => {
  let alive = 0
  let expired = 0
  for (let i = 0; i < KEY_COUNT; i++) {
    const ttl = await redis.ttl(`avalanche:product:${i}`)
    ttl > 0 ? alive++ : expired++
  }
  res.json({ alive, expired, total: KEY_COUNT })
})

export default router
