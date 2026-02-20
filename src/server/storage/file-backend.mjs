/**
 * File-based storage backend.
 *
 * Implements the storage interface using JSON/JSONL files
 * (the original telemetry-server.mjs approach).
 */

import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { ensureDir, readJson } from "../../lib/io.mjs";
import {
  STATE_DIR, EVENTS_PATH, CHAT_PATH, INVITES_PATH, CLAWBOTS_PATH,
  ROOT as PROJECT_ROOT, ALLOWLIST_PATH, POLICY_PATH, OPENSEA_OVERRIDES_PATH,
  QUOTES_PATH, BRIDGE_REQUESTS_PATH,
} from "../../lib/paths.mjs";
import { storageEvents } from "./index.mjs";

const SKILLCARDS_USER_DIR = path.join(STATE_DIR, "skillcards-user");
const SKILLCARDS_USER_INDEX_PATH = path.join(SKILLCARDS_USER_DIR, "index.json");
const SKILLCARDS_SEED_DIR = path.join(PROJECT_ROOT, "skillcards", "seed");
const SKILLCARDS_IMPORTED_INDEX_PATH = path.join(PROJECT_ROOT, "skillcards", "imported", "index.json");

const MERGED_INDEX_CACHE_TTL_MS = 60_000;
let mergedSkillIndexCache = { data: null, expiresAt: 0 };

function sha256(input) {
  return createHash("sha256").update(String(input)).digest("hex");
}

function atomicWriteJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.${randomUUID().slice(0, 8)}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

function buildMergedSkillIndex() {
  const merged = [];
  let seedTokenId = 1;
  try {
    if (fs.existsSync(SKILLCARDS_SEED_DIR)) {
      const seedFiles = fs.readdirSync(SKILLCARDS_SEED_DIR).filter((f) => f.endsWith(".json")).sort();
      for (const fileName of seedFiles) {
        try {
          const filePath = path.join(SKILLCARDS_SEED_DIR, fileName);
          const skill = JSON.parse(fs.readFileSync(filePath, "utf8"));
          if (skill && typeof skill === "object" && skill.name && skill.slug) {
            merged.push({
              name: String(skill.name || "").trim(),
              slug: String(skill.slug || "").trim(),
              description: String(skill.description || "").trim(),
              source: "seed",
              vettedOk: true,
              importOk: true,
              riskTier: Number(skill?.constraints?.riskTier ?? skill?.riskTier ?? 2),
              sourceUrl: String(skill?.provenance?.sourceUrl || "").trim() || null,
              provenance: skill.provenance || { publisher: "apeclaw", signed: false },
              onchainTokenId: String(seedTokenId),
            });
            seedTokenId++;
          }
        } catch { /* skip malformed */ }
      }
    }
  } catch { /* skip */ }

  try {
    if (fs.existsSync(SKILLCARDS_IMPORTED_INDEX_PATH)) {
      const index = JSON.parse(fs.readFileSync(SKILLCARDS_IMPORTED_INDEX_PATH, "utf8"));
      const imported = Array.isArray(index?.imported) ? index.imported : [];
      for (const item of imported) {
        if (item && typeof item === "object" && item.name && item.slug) {
          merged.push({
            name: String(item.name || "").trim(),
            slug: String(item.slug || "").trim(),
            description: String(item.description || "").trim(),
            fileName: String(item.fileName || "").trim() || null,
            source: "imported",
            vettedOk: Boolean(item.vettedOk),
            importOk: Boolean(item.importOk),
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
  } catch { /* skip */ }

  try {
    if (fs.existsSync(SKILLCARDS_USER_INDEX_PATH)) {
      const index = JSON.parse(fs.readFileSync(SKILLCARDS_USER_INDEX_PATH, "utf8"));
      const userSkills = Array.isArray(index?.skills) ? index.skills : [];
      for (const item of userSkills) {
        if (item && typeof item === "object" && item.name && item.slug) {
          merged.push({
            name: String(item.name || "").trim(),
            slug: String(item.slug || "").trim(),
            description: String(item.description || "").trim(),
            source: "user",
            vettedOk: false,
            importOk: true,
            riskTier: Number(item.riskTier ?? 2),
            sourceUrl: String(item.sourceUrl || "").trim() || null,
            provenance: { publisher: "user", signed: false, addedBy: item.addedBy, addedByAgentId: item.addedByAgentId },
          });
        }
      }
    }
  } catch { /* skip */ }

  return merged;
}

export function createFileBackend(opts = {}) {
  ensureDir(path.dirname(EVENTS_PATH));
  if (!fs.existsSync(EVENTS_PATH)) fs.writeFileSync(EVENTS_PATH, "");
  if (!fs.existsSync(CHAT_PATH)) fs.writeFileSync(CHAT_PATH, "");
  ensureDir(path.dirname(INVITES_PATH));
  ensureDir(SKILLCARDS_USER_DIR);
  if (!fs.existsSync(SKILLCARDS_USER_INDEX_PATH)) {
    fs.writeFileSync(SKILLCARDS_USER_INDEX_PATH, JSON.stringify({ skills: [] }, null, 2));
  }

  return {
    // ── Events ──
    appendEvent(evt) {
      fs.appendFileSync(EVENTS_PATH, JSON.stringify(evt) + "\n");
      storageEvents.emit("telemetryEvent", evt);
    },
    getEventBacklog(limit = 300) {
      const raw = fs.readFileSync(EVENTS_PATH, "utf8");
      const lines = raw.trim() ? raw.trim().split("\n") : [];
      return lines.slice(-limit).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    },

    // ── Chat ──
    appendChat(msg) {
      fs.appendFileSync(CHAT_PATH, JSON.stringify(msg) + "\n");
      storageEvents.emit("chatMessage", msg);
    },
    readChatEntries() {
      if (!fs.existsSync(CHAT_PATH)) return [];
      const raw = fs.readFileSync(CHAT_PATH, "utf8").trim();
      if (!raw) return [];
      return raw.split("\n").map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    },

    // ── Invites ──
    readInvites() {
      try {
        if (!fs.existsSync(INVITES_PATH)) return { invites: {} };
        const parsed = JSON.parse(fs.readFileSync(INVITES_PATH, "utf8"));
        if (!parsed || typeof parsed !== "object" || !parsed.invites) return { invites: {} };
        return parsed;
      } catch { return { invites: {} }; }
    },
    writeInvites(data) {
      try {
        ensureDir(path.dirname(INVITES_PATH));
        fs.writeFileSync(INVITES_PATH, JSON.stringify(data, null, 2));
      } catch { /* best-effort */ }
    },

    // ── Skills ──
    getMergedSkillIndex() {
      const now = Date.now();
      if (mergedSkillIndexCache.data && mergedSkillIndexCache.expiresAt > now) return mergedSkillIndexCache.data;
      const index = buildMergedSkillIndex();
      mergedSkillIndexCache = { data: index, expiresAt: now + MERGED_INDEX_CACHE_TTL_MS };
      return index;
    },
    getUserSkillsIndex() {
      return JSON.parse(fs.readFileSync(SKILLCARDS_USER_INDEX_PATH, "utf8"));
    },
    writeUserSkillsIndex(data) {
      atomicWriteJson(SKILLCARDS_USER_INDEX_PATH, data);
    },
    writeUserSkillFile(fileName, data) {
      fs.writeFileSync(path.join(SKILLCARDS_USER_DIR, fileName), JSON.stringify(data, null, 2));
    },
    deleteUserSkillFile(fileName) {
      const fp = path.join(SKILLCARDS_USER_DIR, fileName);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    },
    resolveSkillFilePath(source, fileName) {
      const dirs = {
        seed: SKILLCARDS_SEED_DIR,
        imported: path.join(PROJECT_ROOT, "skillcards", "imported"),
        user: SKILLCARDS_USER_DIR,
      };
      const dir = dirs[source];
      if (!dir || !fileName) return null;
      const fp = path.join(dir, fileName);
      if (fs.existsSync(fp)) return fp;
      return null;
    },
    get SKILLCARDS_USER_DIR() { return SKILLCARDS_USER_DIR; },
    get SKILLCARDS_SEED_DIR() { return SKILLCARDS_SEED_DIR; },

    // ── V2 deployment records ──
    resolveV2DeploymentRecord() {
      try {
        const dir = path.join(STATE_DIR, "v2-deployments");
        if (!fs.existsSync(dir)) return null;
        const entries = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
        if (!entries.length) return null;
        let pick = entries[0], best = -1;
        for (const f of entries) {
          try {
            const mt = Number(fs.statSync(path.join(dir, f)).mtimeMs || 0);
            if (mt > best) { best = mt; pick = f; }
          } catch {}
        }
        const raw = JSON.parse(fs.readFileSync(path.join(dir, pick), "utf8"));
        return raw && typeof raw === "object" ? raw : null;
      } catch { return null; }
    },

    // ── Pod helpers ──
    findPodWorkspaceDir() {
      const envDir = process.env.APE_CLAW_POD_DIR;
      if (envDir) {
        const p = path.resolve(envDir);
        if (fs.existsSync(p) && fs.statSync(p).isDirectory()) return p;
      }
      for (const name of ["pod-workspace", "pod"]) {
        const p = path.join(PROJECT_ROOT, name);
        if (fs.existsSync(p) && fs.statSync(p).isDirectory()) return p;
      }
      return null;
    },

    // ── Quotes ──
    getQuote(quoteId) {
      const all = readJson(QUOTES_PATH, {});
      return all?.[quoteId] || null;
    },
    saveQuote(quoteId, data) {
      const all = readJson(QUOTES_PATH, {}) || {};
      all[quoteId] = data;
      atomicWriteJson(QUOTES_PATH, all);
    },
    updateQuote(quoteId, patch) {
      const all = readJson(QUOTES_PATH, {}) || {};
      if (!all[quoteId]) return null;
      all[quoteId] = { ...all[quoteId], ...patch };
      atomicWriteJson(QUOTES_PATH, all);
      return all[quoteId];
    },
    getQuotesSpendToday() {
      const all = readJson(QUOTES_PATH, {}) || {};
      const dayKey = new Date().toISOString().slice(0, 10);
      return Object.values(all).reduce((sum, q) => {
        if (!q || !q.executedAt || !q.executed) return sum;
        if (new Date(q.executedAt).toISOString().slice(0, 10) !== dayKey) return sum;
        return sum + (Number(q.priceApe) || 0);
      }, 0);
    },

    // ── Bridge requests ──
    getBridgeRequest(requestId) {
      const all = readJson(BRIDGE_REQUESTS_PATH, {});
      return all?.[requestId] || null;
    },
    saveBridgeRequest(requestId, data) {
      const all = readJson(BRIDGE_REQUESTS_PATH, {}) || {};
      all[requestId] = data;
      atomicWriteJson(BRIDGE_REQUESTS_PATH, all);
    },
    updateBridgeRequest(requestId, patch) {
      const all = readJson(BRIDGE_REQUESTS_PATH, {}) || {};
      if (!all[requestId]) return null;
      all[requestId] = { ...all[requestId], ...patch };
      atomicWriteJson(BRIDGE_REQUESTS_PATH, all);
      return all[requestId];
    },
    getBridgeSpendToday() {
      const all = readJson(BRIDGE_REQUESTS_PATH, {}) || {};
      const dayKey = new Date().toISOString().slice(0, 10);
      return Object.values(all).reduce((sum, r) => {
        if (!r || !r.submittedAt) return sum;
        if (r.status === "quoted") return sum;
        if (new Date(r.submittedAt).toISOString().slice(0, 10) !== dayKey) return sum;
        return sum + (Number(r.amount) || 0);
      }, 0);
    },

    close() { /* no-op for file backend */ },
  };
}
