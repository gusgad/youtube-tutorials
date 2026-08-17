/**
 * Fixed-seed pseudo-random number generator (mulberry32), used only by
 * agent_fleet_backoff.js for stagger/backoff timing.
 *
 * This is intentional, not an oversight of CLAUDE.md's "no randomness"
 * rule: a retry storm demo needs jittered timing to be a fair fix (real
 * backoff strategies use jitter specifically to avoid retries
 * resynchronizing). Math.random() would make that jitter genuinely
 * non-reproducible across takes. A seeded PRNG gives timing that looks
 * organic on screen but produces the exact same sequence of delays every
 * time this module is used with the same seed -- the only real source of
 * take-to-take variance left is real model-call latency, which
 * payment_gateway.js's capacity/timing constants are sized to absorb.
 */
export function createRng(seed) {
  let a = seed | 0;
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function jitterMs(rng, minMs, maxMs) {
  return minMs + rng() * (maxMs - minMs);
}
