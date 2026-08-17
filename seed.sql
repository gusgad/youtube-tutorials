-- Seed data for the "production-like" demo database.
--
-- orders  -> six pending orders, one per agent in the fleet scripts
--            (agent_fleet_naive.js / agent_fleet_backoff.js).
-- charges -> the payment gateway's ledger of money that actually moved.
--            This is the source of truth for "did this order get charged" --
--            it is written by the gateway simulator (payment_gateway.js),
--            not by the agent directly.

CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_email TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO orders (customer_email, amount_cents, status) VALUES
    ('alice@example.com', 4999, 'pending_payment'),
    ('bob@example.com', 2499, 'pending_payment'),
    ('carla@example.com', 7999, 'pending_payment'),
    ('deshawn@example.com', 3499, 'pending_payment'),
    ('elena@example.com', 5999, 'pending_payment'),
    ('farid@example.com', 1999, 'pending_payment');

CREATE TABLE charges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    amount_cents INTEGER NOT NULL,
    gateway_txn_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
