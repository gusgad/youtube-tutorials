/**
 * Our own order records -- not the external payment gateway. Looking an
 * order up or marking it paid only ever touches our own database, so
 * unlike charge_card these calls never fail and never need a retry. That
 * is deliberate: the demo's one unreliable dependency is
 * payment_gateway.js, and keeping these two tools trivially reliable
 * keeps that the only thing agents actually have to contend with.
 */
import { openDb } from "./db.js";

export function getOrder(orderId) {
  const db = openDb();
  try {
    const row = db
      .prepare("SELECT id, customer_email, amount_cents, status FROM orders WHERE id = ?")
      .get(orderId);
    return row ?? null;
  } finally {
    db.close();
  }
}

export function markOrderPaid(orderId) {
  const db = openDb();
  try {
    db.prepare("UPDATE orders SET status = 'paid' WHERE id = ?").run(orderId);
  } finally {
    db.close();
  }
}
