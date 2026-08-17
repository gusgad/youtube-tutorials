/**
 * Simulated external payment gateway.
 *
 * Models a rate-limited payments API, not adversarial behavior: the
 * gateway can only process a fixed number of charges at once. A charge
 * that arrives while the gateway is already at capacity is rejected
 * immediately with a simulated 502 -- it is never partially processed, so
 * (unlike a dropped acknowledgment) a 502 here is unambiguous: the charge
 * definitely did not happen. There is no duplicate-charge risk in this
 * scenario; the risk is a fleet of agents independently retrying into the
 * same capacity ceiling and flooding it further.
 *
 * CAPACITY is deliberately small relative to the fleet size the agent
 * scripts run (see agent_fleet_naive.js / agent_fleet_backoff.js), and
 * PROCESSING_MS is deliberately long relative to typical model-call
 * latency, so that a fleet of concurrent agents reliably overlaps inside
 * the gateway's capacity window on every take, regardless of the exact
 * real-world timing of any individual model call. The *shape* of the
 * story (a first-wave pile of rejections for an uncoordinated fleet, a
 * mostly-clean run for a staggered one) is what's guaranteed to
 * reproduce -- not byte-identical timing.
 */
import { openDb } from "./db.js";

const CAPACITY = 2;
const PROCESSING_MS = 6000;

let activeCount = 0;

class GatewayOverloadedError extends Error {
  constructor(message) {
    super(message);
    this.name = "GatewayOverloadedError";
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function chargeCard({ orderId, amountCents }) {
  if (activeCount >= CAPACITY) {
    throw new GatewayOverloadedError(
      `payments API rejected the request for order ${orderId}: at capacity (${activeCount}/${CAPACITY} in flight)`
    );
  }

  activeCount++;
  try {
    await sleep(PROCESSING_MS);

    const gatewayTxnId = `txn_${orderId}_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const db = openDb();
    let insert;
    try {
      insert = db
        .prepare(
          "INSERT INTO charges (order_id, amount_cents, gateway_txn_id) VALUES (?, ?, ?)"
        )
        .run(orderId, amountCents, gatewayTxnId);
    } finally {
      db.close();
    }

    return { gatewayTxnId, chargeId: insert.lastInsertRowid };
  } finally {
    activeCount--;
  }
}

export function countChargesForOrder(orderId) {
  const db = openDb();
  try {
    const row = db
      .prepare("SELECT COUNT(*) AS n FROM charges WHERE order_id = ?")
      .get(orderId);
    return row.n;
  } finally {
    db.close();
  }
}

export { GatewayOverloadedError };
