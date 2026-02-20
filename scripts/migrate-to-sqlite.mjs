#!/usr/bin/env node
/**
 * Migrates existing JSONL/JSON state files into the SQLite database.
 *
 * Usage: node scripts/migrate-to-sqlite.mjs [--db <path>]
 *
 * Reads from:
 *   state/events.jsonl
 *   state/chat.jsonl
 *   state/quotes.json
 *   state/bridge-requests.json
 *   state/invites.json
 *
 * Writes to: <STATE_DIR>/apeclaw.db (or --db override)
 */

import fs from "node:fs";
import path from "node:path";
import { STATE_DIR, EVENTS_PATH, CHAT_PATH, QUOTES_PATH, BRIDGE_REQUESTS_PATH, INVITES_PATH } from "../src/lib/paths.mjs";

const args = process.argv.slice(2);
const dbIdx = args.indexOf("--db");
const dbPathArg = (dbIdx !== -1 && dbIdx + 1 < args.length) ? args[dbIdx + 1] : null;

process.env.APE_CLAW_STORAGE = "sqlite";
if (dbPathArg) process.env.APE_CLAW_SQLITE_DB_PATH = dbPathArg;

const { createSqliteBackend } = await import("../src/server/storage/sqlite-backend.mjs");
const store = createSqliteBackend({ dbPath: dbPathArg || path.join(STATE_DIR, "apeclaw.db") });

let migrated = { events: 0, chat: 0, quotes: 0, bridgeRequests: 0, invites: 0 };

// ── Events ──
if (fs.existsSync(EVENTS_PATH)) {
  const raw = fs.readFileSync(EVENTS_PATH, "utf8").trim();
  if (raw) {
    const lines = raw.split("\n");
    for (const line of lines) {
      try {
        const evt = JSON.parse(line);
        store.appendEvent(evt);
        migrated.events++;
      } catch (e) { console.warn("  skip event line:", e.message); }
    }
  }
}

// ── Chat ──
if (fs.existsSync(CHAT_PATH)) {
  const raw = fs.readFileSync(CHAT_PATH, "utf8").trim();
  if (raw) {
    for (const line of raw.split("\n")) {
      try {
        const msg = JSON.parse(line);
        store.appendChat(msg);
        migrated.chat++;
      } catch (e) { console.warn("  skip chat line:", e.message); }
    }
  }
}

// ── Quotes ──
if (fs.existsSync(QUOTES_PATH)) {
  try {
    const all = JSON.parse(fs.readFileSync(QUOTES_PATH, "utf8"));
    for (const [id, data] of Object.entries(all)) {
      store.saveQuote(id, { ...data, quoteId: id, createdAt: data.createdAt || new Date().toISOString() });
      migrated.quotes++;
    }
  } catch (e) { console.error("Failed to migrate quotes:", e.message); }
}

// ── Bridge requests ──
if (fs.existsSync(BRIDGE_REQUESTS_PATH)) {
  try {
    const all = JSON.parse(fs.readFileSync(BRIDGE_REQUESTS_PATH, "utf8"));
    for (const [id, data] of Object.entries(all)) {
      store.saveBridgeRequest(id, { ...data, requestId: id, createdAt: data.createdAt || new Date().toISOString() });
      migrated.bridgeRequests++;
    }
  } catch (e) { console.error("Failed to migrate bridge requests:", e.message); }
}

// ── Invites ──
if (fs.existsSync(INVITES_PATH)) {
  try {
    const data = JSON.parse(fs.readFileSync(INVITES_PATH, "utf8"));
    if (data?.invites) {
      store.writeInvites(data);
      migrated.invites = Object.keys(data.invites).length;
    }
  } catch (e) { console.error("Failed to migrate invites:", e.message); }
}

store.close();

console.log("Migration complete:");
console.log(JSON.stringify(migrated, null, 2));
