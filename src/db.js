// Simulates a real DB with network latency
// All data lives in memory so the demo has zero external dependencies

const products = {
  '1': { id: '1', name: 'Mechanical Keyboard', price: 129.99 },
  '2': { id: '2', name: 'USB-C Hub', price: 49.99 },
  '42': { id: '42', name: 'Viral Product', price: 999.99 },
}

const DB_DELAY_MS = 200  // make the cache miss vs hit difference visible in the demo

export async function fetchProduct(id) {
  await delay(DB_DELAY_MS)
  console.log(`[DB] SELECT * FROM products WHERE id = ${id}`)
  return products[id] ?? null
}

export async function fetchLeaderboard() {
  await delay(DB_DELAY_MS)
  console.log('[DB] SELECT * FROM leaderboard ORDER BY score DESC LIMIT 10')
  return [
    { user: 'alice', score: 9800 },
    { user: 'bob',   score: 8700 },
    { user: 'carol', score: 7600 },
  ]
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
