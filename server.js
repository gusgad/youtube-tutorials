import express from "express";
import { Pool } from "pg";

const app = express();
const db = new Pool();

let readinessState = { ready: true, checkedAt: 0, reason: "startup" };

async function computeReadiness() {
  try {
    const check = db.query("SELECT 1", []);
    const timeout = new Promise((_, rej) =>
      setTimeout(() => rej(new Error("db check timeout")), 500)
    );
    await Promise.race([check, timeout]);
    readinessState = { ready: true, checkedAt: Date.now(), reason: "ok" };
  } catch (err) {
    readinessState = {
      ready: false,
      checkedAt: Date.now(),
      reason: err.message,
    };
  }
}

// Run in background — decouples probe frequency from check cost.
setInterval(computeReadiness, 2000);

// -------- Liveness: cheap, no dependencies. --------
app.get("/livez", (_req, res) => res.status(200).send("ok"));

// -------- Readiness: reflects cached state. --------
app.get("/readyz", (_req, res) => {
  if (readinessState.ready) return res.status(200).send("ok");
  res.status(503).send(readinessState.reason);
});

// -------- Startup: gate on one-time init. --------
let initialized = false;
(async function init() {
  await warmCaches();
  await computeReadiness();
  initialized = true;
})();
app.get("/startupz", (_req, res) =>
  res.status(initialized ? 200 : 503).send(initialized ? "ok" : "starting")
);

// -------- Graceful shutdown --------
// Fail readiness first, wait for LB to notice, then drain.
let shuttingDown = false;
process.on("SIGTERM", async () => {
  shuttingDown = true;
  readinessState = { ready: false, checkedAt: Date.now(), reason: "shutdown" };
  // Give the LB time to observe the failing readiness probe.
  await new Promise((r) => setTimeout(r, 15_000));
  server.close(() => process.exit(0));
});

const server = app.listen(3000);

async function warmCaches() { /* ... */ }