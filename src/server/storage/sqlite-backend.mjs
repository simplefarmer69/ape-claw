/**
 * SQLite storage backend (WAL mode, better-sqlite3).
 *
 * Drop-in replacement for file-backend.mjs behind the storage abstraction.
 * Enabled by setting APE_CLAW_STORAGE=sqlite (default DB path: <STATE_DIR>/apeclaw.db).
 */

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { ensureDir } from "../../lib/io.mjs";
import { STATE_DIR, ROOT as PROJECT_ROOT } from "../../lib/paths.mjs";
import { storageEvents } from "./index.mjs";

const SKILLCARDS_USER_DIR = path.join(STATE_DIR, "skillcards-user");
const SKILLCARDS_USER_INDEX_PATH = path.join(SKILLCARDS_USER_DIR, "index.json");
const SKILLCARDS_SEED_DIR = path.join(PROJECT_ROOT, "skillcards", "seed");
const SKILLCARDS_IMPORTED_INDEX_PATH = path.join(PROJECT_ROOT, "skillcards", "imported", "index.json");
const MERGED_INDEX_CACHE_TTL_MS = 60_000;
let mergedSkillIndexCache = { data: null, expiresAt: 0 };

function initDb(dbPath) {
  ensureDir(path.dirname(dbPath));
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");

  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT NOT NULL,
      eventType TEXT NOT NULL,
      agentId TEXT,
      sessionId TEXT,
      traceId TEXT,
      command TEXT,
      dryRun INTEGER DEFAULT 0,
      chainId INTEGER DEFAULT 33139,
      payload TEXT DEFAULT '{}',
      result TEXT DEFAULT '{}',
      ok INTEGER DEFAULT 1,
      error TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_events_agentId_ts ON events(agentId, ts);
    CREATE INDEX IF NOT EXISTS idx_events_traceId ON events(traceId);
    CREATE INDEX IF NOT EXISTS idx_events_eventType ON events(eventType);

    CREATE TABLE IF NOT EXISTS quotes (
      quoteId TEXT PRIMARY KEY,
      collection TEXT,
      tokenId TEXT,
      priceApe REAL,
      maxPrice REAL,
      currency TEXT,
      expiresAt TEXT,
      status TEXT DEFAULT 'quoted',
      simulated INTEGER DEFAULT 0,
      executed INTEGER DEFAULT 0,
      executedAt TEXT,
      agentId TEXT,
      createdAt TEXT NOT NULL,
      payload TEXT DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS idx_quotes_agentId ON quotes(agentId, createdAt);
    CREATE INDEX IF NOT EXISTS idx_quotes_executedAt ON quotes(executedAt);

    CREATE TABLE IF NOT EXISTS bridge_requests (
      requestId TEXT PRIMARY KEY,
      fromChain TEXT,
      toChain TEXT,
      token TEXT,
      amount REAL,
      status TEXT DEFAULT 'quoted',
      feeBps INTEGER,
      expiresAt TEXT,
      submittedAt TEXT,
      agentId TEXT,
      createdAt TEXT NOT NULL,
      payload TEXT DEFAULT '{}'
    );

    CREATE INDEX IF NOT EXISTS idx_bridge_requests_submittedAt ON bridge_requests(submittedAt);

    CREATE TABLE IF NOT EXISTS chat (
      id TEXT PRIMARY KEY,
      type TEXT DEFAULT 'message',
      room TEXT DEFAULT 'general',
      ts TEXT NOT NULL,
      agentId TEXT,
      agentName TEXT,
      identityProvider TEXT,
      identityMeta TEXT DEFAULT '{}',
      text TEXT,
      replyTo TEXT,
      messageId TEXT,
      emoji TEXT,
      payload TEXT DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS idx_chat_room_ts ON chat(room, ts);

    CREATE TABLE IF NOT EXISTS clawbots (
      agentId TEXT PRIMARY KEY,
      name TEXT,
      tokenHash TEXT,
      createdAt TEXT,
      enabled INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS invites (
      tokenHash TEXT PRIMARY KEY,
      createdAt TEXT,
      expiresAt TEXT,
      usesRemaining INTEGER DEFAULT 1,
      lastUsedAt TEXT
    );
  `);

  return db;
}

function buildMergedSkillIndex() {
  const merged = [];
  let seedTokenId = 1;
  try {
    if (fs.existsSync(SKILLCARDS_SEED_DIR)) {
      for (const f of fs.readdirSync(SKILLCARDS_SEED_DIR).filter((x) => x.endsWith(".json")).sort()) {
        try {
          const skill = JSON.parse(fs.readFileSync(path.join(SKILLCARDS_SEED_DIR, f), "utf8"));
          if (skill?.name && skill?.slug) {
            merged.push({
              name: String(skill.name).trim(), slug: String(skill.slug).trim(),
              description: String(skill.description || "").trim(), source: "seed",
              vettedOk: true, importOk: true,
              riskTier: Number(skill?.constraints?.riskTier ?? skill?.riskTier ?? 2),
              sourceUrl: String(skill?.provenance?.sourceUrl || "").trim() || null,
              provenance: skill.provenance || { publisher: "apeclaw", signed: false },
              onchainTokenId: String(seedTokenId++),
            });
          }
        } catch {}
      }
    }
  } catch {}
  try {
    if (fs.existsSync(SKILLCARDS_IMPORTED_INDEX_PATH)) {
      const idx = JSON.parse(fs.readFileSync(SKILLCARDS_IMPORTED_INDEX_PATH, "utf8"));
      for (const item of (Array.isArray(idx?.imported) ? idx.imported : [])) {
        if (item?.name && item?.slug) {
          merged.push({
            name: String(item.name).trim(), slug: String(item.slug).trim(),
            description: String(item.description || "").trim(),
            fileName: String(item.fileName || "").trim() || null,
            source: "imported", vettedOk: Boolean(item.vettedOk), importOk: Boolean(item.importOk),
            riskTier: Number(item.riskTier ?? 2),
            sourceUrl: String(item.sourceUrl || "").trim() || null,
            provenance: item.provenance || { publisher: "imported", signed: false },
            onchainTokenId: item.onchainTokenId || null,
            onchainMintTx: item.onchainMintTx || null,
            onchainPublishTx: item.onchainPublishTx || null,
          });
        }
      }
    }
  } catch {}
  try {
    if (fs.existsSync(SKILLCARDS_USER_INDEX_PATH)) {
      const idx = JSON.parse(fs.readFileSync(SKILLCARDS_USER_INDEX_PATH, "utf8"));
      for (const item of (Array.isArray(idx?.skills) ? idx.skills : [])) {
        if (item?.name && item?.slug) {
          merged.push({
            name: String(item.name).trim(), slug: String(item.slug).trim(),
            description: String(item.description || "").trim(),
            source: "user", vettedOk: false, importOk: true,
            riskTier: Number(item.riskTier ?? 2),
            sourceUrl: String(item.sourceUrl || "").trim() || null,
            provenance: { publisher: "user", signed: false, addedBy: item.addedBy, addedByAgentId: item.addedByAgentId },
          });
        }
      }
    }
  } catch {}
  return merged;
}

export function createSqliteBackend(opts = {}) {
  const dbPath = opts.dbPath || path.join(STATE_DIR, "apeclaw.db");
  const db = initDb(dbPath);

  ensureDir(SKILLCARDS_USER_DIR);
  if (!fs.existsSync(SKILLCARDS_USER_INDEX_PATH)) {
    fs.writeFileSync(SKILLCARDS_USER_INDEX_PATH, JSON.stringify({ skills: [] }, null, 2));
  }

  const stmts = {
    insertEvent: db.prepare(`INSERT INTO events (ts, eventType, agentId, sessionId, traceId, command, dryRun, chainId, payload, result, ok, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    getEventBacklog: db.prepare(`SELECT * FROM events ORDER BY id DESC LIMIT ?`),
    insertChat: db.prepare(`INSERT INTO chat (id, type, room, ts, agentId, agentName, identityProvider, identityMeta, text, replyTo, messageId, emoji) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    getChat: db.prepare(`SELECT * FROM chat ORDER BY ts ASC`),
    getInvite: db.prepare(`SELECT * FROM invites WHERE tokenHash = ?`),
    upsertInvite: db.prepare(`INSERT OR REPLACE INTO invites (tokenHash, createdAt, expiresAt, usesRemaining, lastUsedAt) VALUES (?, ?, ?, ?, ?)`),
    getAllInvites: db.prepare(`SELECT * FROM invites`),
    getQuote: db.prepare(`SELECT * FROM quotes WHERE quoteId = ?`),
    upsertQuote: db.prepare(`INSERT OR REPLACE INTO quotes (quoteId, collection, tokenId, priceApe, maxPrice, currency, expiresAt, status, simulated, executed, executedAt, agentId, createdAt, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    getBridgeReq: db.prepare(`SELECT * FROM bridge_requests WHERE requestId = ?`),
    upsertBridgeReq: db.prepare(`INSERT OR REPLACE INTO bridge_requests (requestId, fromChain, toChain, token, amount, status, feeBps, expiresAt, submittedAt, agentId, createdAt, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  };

  return {
    appendEvent(evt) {
      stmts.insertEvent.run(
        evt.ts, evt.eventType, evt.agentId, evt.sessionId, evt.traceId,
        evt.command, evt.dryRun ? 1 : 0, evt.chainId,
        JSON.stringify(evt.payload || {}), JSON.stringify(evt.result || {}),
        evt.ok ? 1 : 0, evt.error || null,
      );
      storageEvents.emit("telemetryEvent", evt);
    },
    getEventBacklog(limit = 300) {
      const rows = stmts.getEventBacklog.all(limit).reverse();
      return rows.map((r) => ({
        ...r, dryRun: Boolean(r.dryRun), ok: Boolean(r.ok),
        payload: JSON.parse(r.payload || "{}"), result: JSON.parse(r.result || "{}"),
      }));
    },

    appendChat(msg) {
      stmts.insertChat.run(
        msg.id, msg.type || "message", msg.room || "general", msg.ts,
        msg.agentId, msg.agentName, msg.identityProvider,
        JSON.stringify(msg.identityMeta || {}), msg.text, msg.replyTo || null,
        msg.messageId || null, msg.emoji || null,
      );
      storageEvents.emit("chatMessage", msg);
    },
    readChatEntries() {
      return stmts.getChat.all().map((r) => ({
        ...r, identityMeta: JSON.parse(r.identityMeta || "{}"),
      }));
    },

    readInvites() {
      const rows = stmts.getAllInvites.all();
      const invites = {};
      for (const r of rows) invites[r.tokenHash] = r;
      return { invites };
    },
    writeInvites(data) {
      const invites = data?.invites || {};
      for (const [hash, row] of Object.entries(invites)) {
        stmts.upsertInvite.run(hash, row.createdAt, row.expiresAt, row.usesRemaining, row.lastUsedAt || null);
      }
    },

    getMergedSkillIndex() {
      const now = Date.now();
      if (mergedSkillIndexCache.data && mergedSkillIndexCache.expiresAt > now) return mergedSkillIndexCache.data;
      const index = buildMergedSkillIndex();
      mergedSkillIndexCache = { data: index, expiresAt: now + MERGED_INDEX_CACHE_TTL_MS };
      return index;
    },
    getUserSkillsIndex() { return JSON.parse(fs.readFileSync(SKILLCARDS_USER_INDEX_PATH, "utf8")); },
    writeUserSkillsIndex(data) {
      const tmp = `${SKILLCARDS_USER_INDEX_PATH}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
      fs.renameSync(tmp, SKILLCARDS_USER_INDEX_PATH);
    },
    writeUserSkillFile(fileName, data) {
      fs.writeFileSync(path.join(SKILLCARDS_USER_DIR, fileName), JSON.stringify(data, null, 2));
    },
    deleteUserSkillFile(fileName) {
      const fp = path.join(SKILLCARDS_USER_DIR, fileName);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    },
    resolveSkillFilePath(source, fileName) {
      const dirs = { seed: SKILLCARDS_SEED_DIR, imported: path.join(PROJECT_ROOT, "skillcards", "imported"), user: SKILLCARDS_USER_DIR };
      const dir = dirs[source];
      if (!dir || !fileName) return null;
      const fp = path.join(dir, fileName);
      return fs.existsSync(fp) ? fp : null;
    },
    get SKILLCARDS_USER_DIR() { return SKILLCARDS_USER_DIR; },
    get SKILLCARDS_SEED_DIR() { return SKILLCARDS_SEED_DIR; },

    resolveV2DeploymentRecord() {
      try {
        const dir = path.join(STATE_DIR, "v2-deployments");
        if (!fs.existsSync(dir)) return null;
        const entries = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
        if (!entries.length) return null;
        let pick = entries[0], best = -1;
        for (const f of entries) {
          try { const mt = Number(fs.statSync(path.join(dir, f)).mtimeMs || 0); if (mt > best) { best = mt; pick = f; } } catch {}
        }
        return JSON.parse(fs.readFileSync(path.join(dir, pick), "utf8"));
      } catch { return null; }
    },

    findPodWorkspaceDir() {
      const envDir = process.env.APE_CLAW_POD_DIR;
      if (envDir) { const p = path.resolve(envDir); if (fs.existsSync(p) && fs.statSync(p).isDirectory()) return p; }
      for (const name of ["pod-workspace", "pod"]) {
        const p = path.join(PROJECT_ROOT, name);
        if (fs.existsSync(p) && fs.statSync(p).isDirectory()) return p;
      }
      return null;
    },

    getQuote(quoteId) {
      const row = stmts.getQuote.get(quoteId);
      return row ? { ...row, payload: JSON.parse(row.payload || "{}"), simulated: Boolean(row.simulated), executed: Boolean(row.executed) } : null;
    },
    saveQuote(quoteId, data) {
      stmts.upsertQuote.run(
        quoteId, data.collection, data.tokenId, data.priceApe, data.maxPrice,
        data.currency, data.expiresAt, data.status || "quoted",
        data.simulated ? 1 : 0, data.executed ? 1 : 0, data.executedAt || null,
        data.agentId, data.createdAt, JSON.stringify(data.payload || data),
      );
    },
    updateQuote(quoteId, patch) {
      const existing = stmts.getQuote.get(quoteId);
      if (!existing) return null;
      const existingPayload = JSON.parse(existing.payload || "{}");
      const mergedPayload = patch.payload ? { ...existingPayload, ...patch.payload } : existingPayload;
      const merged = {
        ...existing, ...patch,
        payload: mergedPayload,
        simulated: Boolean(patch.simulated ?? existing.simulated),
        executed: Boolean(patch.executed ?? existing.executed),
      };
      const payloadStr = JSON.stringify(mergedPayload);
      stmts.upsertQuote.run(
        quoteId, merged.collection, merged.tokenId, merged.priceApe, merged.maxPrice,
        merged.currency, merged.expiresAt, merged.status,
        merged.simulated ? 1 : 0, merged.executed ? 1 : 0, merged.executedAt || null,
        merged.agentId, merged.createdAt, payloadStr,
      );
      return merged;
    },
    getQuotesSpendToday() {
      const dayKey = new Date().toISOString().slice(0, 10);
      const row = db.prepare(`SELECT COALESCE(SUM(priceApe), 0) as total FROM quotes WHERE executed = 1 AND executedAt LIKE ? || '%'`).get(dayKey);
      return row?.total || 0;
    },

    getBridgeRequest(requestId) {
      const row = stmts.getBridgeReq.get(requestId);
      return row ? { ...row, payload: JSON.parse(row.payload || "{}") } : null;
    },
    saveBridgeRequest(requestId, data) {
      stmts.upsertBridgeReq.run(
        requestId, data.fromChain || data.from, data.toChain || data.to, data.token,
        data.amount, data.status || "quoted", data.feeBps, data.expiresAt,
        data.submittedAt || null, data.agentId, data.createdAt,
        JSON.stringify(data.payload || data),
      );
    },
    updateBridgeRequest(requestId, patch) {
      const existing = stmts.getBridgeReq.get(requestId);
      if (!existing) return null;
      const existingPayload = JSON.parse(existing.payload || "{}");
      const mergedPayload = patch.payload ? { ...existingPayload, ...patch.payload } : existingPayload;
      const merged = { ...existing, ...patch, payload: mergedPayload };
      stmts.upsertBridgeReq.run(
        requestId, merged.fromChain, merged.toChain, merged.token,
        merged.amount, merged.status, merged.feeBps, merged.expiresAt,
        merged.submittedAt || null, merged.agentId, merged.createdAt,
        JSON.stringify(mergedPayload),
      );
      return merged;
    },
    getBridgeSpendToday() {
      const dayKey = new Date().toISOString().slice(0, 10);
      const row = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM bridge_requests WHERE status != 'quoted' AND submittedAt LIKE ? || '%'`).get(dayKey);
      return row?.total || 0;
    },

    close() { db.close(); },
  };
}
