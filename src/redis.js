import { createClient } from 'redis'

const redis = createClient({
  host: 'localhost',
  port: 6379,
})

redis.on('error', (err) => console.error('Redis error:', err))

await redis.connect()

export default redis
