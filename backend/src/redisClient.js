const { createClient } = require('redis');
const config = require('./config');

const redisClient = createClient({ url: config.redis.url });
redisClient.on('error', (err) => console.error('Redis error:', err));

let connectPromise = null;
function getRedis() {
  if (!connectPromise) {
    connectPromise = redisClient.connect().then(() => redisClient);
  }
  return connectPromise;
}

module.exports = { redisClient, getRedis };
