/**
 * Shared SQLite access for the demo agents.
 *
 * Replaces the original Postgres-via-Docker setup: appdb.sqlite is a
 * plain file created next to this module, auto-seeded from seed.sql on
 * first use. No provisioning step, no daemon to start.
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "appdb.sqlite");

export function openDb() {
  const isNew = !fs.existsSync(DB_PATH);
  const db = new DatabaseSync(DB_PATH);
  if (isNew) {
    const seedSql = fs.readFileSync(path.join(__dirname, "seed.sql"), "utf8");
    db.exec(seedSql);
  }
  return db;
}
