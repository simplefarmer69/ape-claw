import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { createPublicClient, getContract, http as viemHttp, keccak256, toHex } from "viem";
import { ROOT as PROJECT_ROOT, STATE_DIR, EVENTS_PATH, ALLOWLIST_PATH, POLICY_PATH, OPENSEA_OVERRIDES_PATH, CLAWBOTS_PATH, CHAT_PATH, INVITES_PATH } from "./lib/paths.mjs";
import { ensureDir } from "./lib/io.mjs";
import { verifyClawbot, registerClawbot } from "./lib/clawbots.mjs";
import { ReceiptRegistry_ABI } from "./lib/v2-onchain-abi.mjs";

const PORT = Number(process.env.APE_CLAW_UI_PORT || 8787);
const BIND_HOST = String(process.env.APE_CLAW_BIND_HOST || "").trim();
const ROOT = PROJECT_ROOT;
const UI_PATH = path.join(ROOT, "ui", "index.html");
const clients = new Set();
const OPENSEA_API_BASE = "https://api.opensea.io/api/v2";
const MOLTBOOK_API_BASE = String(process.env.MOLTBOOK_API_BASE || "https://www.moltbook.com/api/v1").replace(/\/+$/, "");
const MOLTBOOK_APP_KEY = String(process.env.MOLTBOOK_APP_KEY || "").trim();
const REGISTRATION_KEY = String(process.env.APE_CLAW_REGISTRATION_KEY || "").trim();
const OPEN_REGISTRATION = /^(1|true|yes|on)$/i.test(String(process.env.APE_CLAW_OPEN_REGISTRATION || "").trim());
const REGISTRATION_COOLDOWN_MS = Math.max(
  0,
  Number(process.env.APE_CLAW_REGISTRATION_COOLDOWN_MS || 10000),
);
const registrationByIp = new Map();
const INVITE_TTL_MS = Math.max(60_000, Number(process.env.APE_CLAW_INVITE_TTL_MS || 24 * 60 * 60 * 1000));
const INVITE_MAX_USES = Math.max(1, Number(process.env.APE_CLAW_INVITE_MAX_USES || 5));
const ICON_CACHE_TTL_MS = 10 * 60 * 1000;
let allowlistIconCache = { expiresAt: 0, data: null, inFlight: null };

function resolveV2DeploymentRecord() {
  // Best-effort: used only for read-only UX helpers (no signing).
  try {
    const dir = path.join(STATE_DIR, "v2-deployments");
    if (!fs.existsSync(dir)) return null;
    const entries = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
    if (!entries.length) return null;
    // Choose the most recently modified record (better for local dev).
    let pick = entries[0];
    let best = -1;
    for (const f of entries) {
      try {
        const st = fs.statSync(path.join(dir, f));
        const mt = Number(st.mtimeMs || 0);
        if (mt > best) { best = mt; pick = f; }
      } catch {}
    }
    const raw = JSON.parse(fs.readFileSync(path.join(dir, pick), "utf8"));
    return raw && typeof raw === "object" ? raw : null;
  } catch {
    return null;
  }
}

function resolveV2ReceiptReadConfig() {
  const fromEnvRpc = String(process.env.APE_CLAW_V2_RPC_URL || process.env.RPC_URL_33139 || "").trim();
  const fromEnvReceipts = String(process.env.APE_CLAW_V2_RECEIPT_REGISTRY || "").trim();
  const rec = resolveV2DeploymentRecord();
  const receiptsAddress = fromEnvReceipts || String(rec?.receipts || "").trim();
  let rpcUrl = fromEnvRpc;
  let inferredRpc = false;
  if (!rpcUrl && rec && Number(rec.chainId) === 31337) {
    // Local Hardhat node default (only if we detect a local deployment record).
    rpcUrl = "http://127.0.0.1:8545";
    inferredRpc = true;
  }
  if (!rpcUrl || !receiptsAddress) {
    return {
      ok: false,
      rpcUrl: rpcUrl || "",
      receiptsAddress: receiptsAddress || "",
      inferredRpc,
      reason: "missing v2 config (set APE_CLAW_V2_RPC_URL and APE_CLAW_V2_RECEIPT_REGISTRY, or run contracts seed locally)",
    };
  }
  return { ok: true, rpcUrl, receiptsAddress, inferredRpc };
}

ensureDir(path.dirname(EVENTS_PATH));
if (!fs.existsSync(EVENTS_PATH)) fs.writeFileSync(EVENTS_PATH, "");
if (!fs.existsSync(CHAT_PATH)) fs.writeFileSync(CHAT_PATH, "");
ensureDir(path.dirname(INVITES_PATH));

// User-submitted SkillCards (stored server-side; no secrets).
const SKILLCARDS_USER_DIR = path.join(STATE_DIR, "skillcards-user");
const SKILLCARDS_USER_INDEX_PATH = path.join(SKILLCARDS_USER_DIR, "index.json");
ensureDir(SKILLCARDS_USER_DIR);
if (!fs.existsSync(SKILLCARDS_USER_INDEX_PATH)) {
  fs.writeFileSync(SKILLCARDS_USER_INDEX_PATH, JSON.stringify({ skills: [] }, null, 2));
}

// SkillCards paths
const SKILLCARDS_SEED_DIR = path.join(ROOT, "skillcards", "seed");
const SKILLCARDS_IMPORTED_INDEX_PATH = path.join(ROOT, "skillcards", "imported", "index.json");

// Cache for merged skill index (60 seconds TTL)
let mergedSkillIndexCache = { data: null, expiresAt: 0 };
const MERGED_INDEX_CACHE_TTL_MS = 60 * 1000;

function buildMergedSkillIndex() {
  const merged = [];

  // 1. Read seed skills from skillcards/seed/*.json
  try {
    if (fs.existsSync(SKILLCARDS_SEED_DIR)) {
      const seedFiles = fs.readdirSync(SKILLCARDS_SEED_DIR).filter((f) => f.endsWith(".json"));
      for (const fileName of seedFiles) {
        try {
          const filePath = path.join(SKILLCARDS_SEED_DIR, fileName);
          const raw = fs.readFileSync(filePath, "utf8");
          const skill = JSON.parse(raw);
          if (skill && typeof skill === "object" && skill.name && skill.slug) {
            merged.push({
              name: String(skill.name || "").trim(),
              slug: String(skill.slug || "").trim(),
              description: String(skill.description || "").trim(),
              source: "seed",
              vettedOk: true, // Seed skills are trusted
              importOk: true,
              riskTier: Number(skill?.constraints?.riskTier ?? skill?.riskTier ?? 2),
              sourceUrl: String(skill?.provenance?.sourceUrl || "").trim() || null,
              provenance: skill.provenance || { publisher: "apeclaw", signed: false },
            });
          }
        } catch {
          // Skip malformed seed files
        }
      }
    }
  } catch {
    // Skip if seed directory doesn't exist or can't be read
  }

  // 2. Read imported skills from skillcards/imported/index.json
  try {
    if (fs.existsSync(SKILLCARDS_IMPORTED_INDEX_PATH)) {
      const raw = fs.readFileSync(SKILLCARDS_IMPORTED_INDEX_PATH, "utf8");
      const index = JSON.parse(raw);
      const imported = Array.isArray(index?.imported) ? index.imported : [];
      const importedDir = path.join(ROOT, "skillcards", "imported");
      for (const item of imported) {
        if (item && typeof item === "object" && item.name && item.slug) {
          // Try to read description from the actual JSON file if not in index
          let description = String(item.description || "").trim();
          if (!description && item.fileName) {
            try {
              const filePath = path.join(importedDir, item.fileName);
              if (fs.existsSync(filePath)) {
                const fileRaw = fs.readFileSync(filePath, "utf8");
                const fileSkill = JSON.parse(fileRaw);
                description = String(fileSkill?.description || "").trim();
              }
            } catch {
              // Fall back to empty description
            }
          }
          merged.push({
            name: String(item.name || "").trim(),
            slug: String(item.slug || "").trim(),
            description,
            source: "imported",
            vettedOk: Boolean(item.vettedOk),
            importOk: Boolean(item.importOk),
            riskTier: Number(item.riskTier ?? 2),
            sourceUrl: String(item.sourceUrl || "").trim() || null,
            provenance: item.provenance || { publisher: "imported", signed: false },
          });
        }
      }
    }
  } catch {
    // Skip if imported index doesn't exist or can't be read
  }

  // 3. Read user skills from state/skillcards-user/*.json files
  try {
    if (fs.existsSync(SKILLCARDS_USER_INDEX_PATH)) {
      const raw = fs.readFileSync(SKILLCARDS_USER_INDEX_PATH, "utf8");
      const index = JSON.parse(raw);
      const userSkills = Array.isArray(index?.skills) ? index.skills : [];
      for (const item of userSkills) {
        if (item && typeof item === "object" && item.name && item.slug) {
          merged.push({
            name: String(item.name || "").trim(),
            slug: String(item.slug || "").trim(),
            description: String(item.description || "").trim(),
            source: "user",
            vettedOk: false, // User skills are not vetted by default
            importOk: true,
            riskTier: Number(item.riskTier ?? 2),
            sourceUrl: String(item.sourceUrl || "").trim() || null,
            provenance: { publisher: "user", signed: false, addedBy: item.addedBy, addedByAgentId: item.addedByAgentId },
          });
        }
      }
    }
  } catch {
    // Skip if user index doesn't exist or can't be read
  }

  return merged;
}

function getMergedSkillIndex() {
  const now = Date.now();
  if (mergedSkillIndexCache.data && mergedSkillIndexCache.expiresAt > now) {
    return mergedSkillIndexCache.data;
  }
  const index = buildMergedSkillIndex();
  mergedSkillIndexCache = {
    data: index,
    expiresAt: now + MERGED_INDEX_CACHE_TTL_MS,
  };
  return index;
}

function safeVersion(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  // Keep filenames safe and predictable.
  if (!/^[0-9]+(\.[0-9]+){0,3}([\-+][0-9A-Za-z._-]+)?$/.test(s)) return "";
  return s;
}

function atomicWriteJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.${randomUUID().slice(0, 8)}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

function requireSkillWriteAuth(req) {
  // Allow either admin key OR an authenticated clawbot.
  const adminKey = String(req.headers["x-registration-key"] || "").trim();
  if (adminKey && REGISTRATION_KEY && adminKey === REGISTRATION_KEY) {
    return { ok: true, mode: "admin", agentId: null };
  }
  const agentId = String(req.headers["x-agent-id"] || "").trim();
  const agentToken = String(req.headers["x-agent-token"] || "").trim();
  if (agentId && agentToken) {
    try {
      const v = verifyClawbot(agentId, agentToken);
      if (v?.ok) return { ok: true, mode: "agent", agentId };
    } catch {}
  }
  return { ok: false, mode: "none", agentId: null };
}

function sendSse(res, evt) {
  res.write(`data: ${JSON.stringify(evt)}\n\n`);
}

function sendBacklog(res) {
  const raw = fs.readFileSync(EVENTS_PATH, "utf8");
  const lines = raw.trim() ? raw.trim().split("\n") : [];
  const events = lines.slice(-300).map((l) => {
    try {
      return JSON.parse(l);
    } catch {
      return null;
    }
  }).filter(Boolean);
  res.writeHead(200, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
  });
  res.end(JSON.stringify({ events }));
}

function serveJson(res, filePath) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { "content-type": "application/json" });
    return res.end(JSON.stringify({ error: "not found" }));
  }
  const raw = fs.readFileSync(filePath, "utf8");
  res.writeHead(200, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
  });
  return res.end(raw);
}

function toSlug(input) {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/®/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function buildSlugCandidates(item, overrides = {}) {
  const raw = String(item?.name || "");
  const base = toSlug(raw);
  const fromOverride = overrides[raw] || overrides[base] || [];
  return unique([
    item?.slug,
    base,
    base.replace(/-on-apechain$/, ""),
    base.replace(/-on-ape$/, ""),
    base.replace(/-/g, ""),
    ...(Array.isArray(fromOverride) ? fromOverride : [fromOverride]),
  ]);
}

async function fetchJson(url, headers = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function extractCollectionImage(payload) {
  const c = payload?.collection || payload || {};
  return (
    c?.image_url ||
    c?.imageUrl ||
    c?.banner_image_url ||
    c?.bannerImageUrl ||
    null
  );
}

async function resolveCollectionIcon(item, headers, overrides) {
  const candidates = buildSlugCandidates(item, overrides);
  for (const slug of candidates) {
    try {
      const data = await fetchJson(`${OPENSEA_API_BASE}/collections/${encodeURIComponent(slug)}`, headers);
      const imageUrl = extractCollectionImage(data);
      if (imageUrl) return { imageUrl, openseaSlug: slug };
    } catch {
      // continue slug variants
    }
    try {
      const nftData = await fetchJson(
        `${OPENSEA_API_BASE}/collection/${encodeURIComponent(slug)}/nfts?limit=1`,
        headers,
      );
      const first = Array.isArray(nftData?.nfts) ? nftData.nfts[0] : null;
      const imageUrl = first?.image_url || first?.display_image_url || first?.imageUrl || null;
      if (imageUrl) return { imageUrl, openseaSlug: slug };
    } catch {
      // continue slug variants
    }
  }
  return { imageUrl: null, openseaSlug: null };
}

async function mapWithConcurrency(items, limit, mapper) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await mapper(items[idx], idx);
    }
  }
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () => worker());
  await Promise.all(workers);
  return out;
}

async function getAllowlistWithIcons() {
  const now = Date.now();
  if (allowlistIconCache.data && allowlistIconCache.expiresAt > now) return allowlistIconCache.data;
  if (allowlistIconCache.inFlight) return allowlistIconCache.inFlight;

  allowlistIconCache.inFlight = (async () => {
    const raw = fs.readFileSync(ALLOWLIST_PATH, "utf8");
    const allowlist = JSON.parse(raw);
    const key = process.env.OPENSEA_API_KEY || "";
    if (!key) {
      const plain = allowlist.map((c) => ({ ...c, imageUrl: null, openseaSlug: c.slug || null }));
      allowlistIconCache = { expiresAt: now + ICON_CACHE_TTL_MS, data: plain, inFlight: null };
      return plain;
    }
    let overrides = {};
    if (fs.existsSync(OPENSEA_OVERRIDES_PATH)) {
      try {
        overrides = JSON.parse(fs.readFileSync(OPENSEA_OVERRIDES_PATH, "utf8"));
      } catch {
        overrides = {};
      }
    }
    const headers = { "x-api-key": key, accept: "application/json" };
    const enriched = await mapWithConcurrency(allowlist, 8, async (item) => {
      const icon = await resolveCollectionIcon(item, headers, overrides);
      return {
        ...item,
        imageUrl: icon.imageUrl,
        openseaSlug: icon.openseaSlug || item.slug || null,
      };
    });
    allowlistIconCache = { expiresAt: Date.now() + ICON_CACHE_TTL_MS, data: enriched, inFlight: null };
    return enriched;
  })();

  try {
    return await allowlistIconCache.inFlight;
  } finally {
    if (allowlistIconCache.inFlight && allowlistIconCache.expiresAt < Date.now()) {
      allowlistIconCache.inFlight = null;
    }
  }
}

// ── Chat helpers ────────────────────────────────────────

const chatClients = new Set();

function sendChatSse(res, msg) {
  res.write(`data: ${JSON.stringify(msg)}\n\n`);
}

function normalizeRoomName(input) {
  const raw = String(input || "general")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return raw || "general";
}

function broadcastChat(msg) {
  for (const client of chatClients) {
    try {
      const wantsRoom = normalizeRoomName(client.room || "all");
      if (wantsRoom !== "all" && wantsRoom !== normalizeRoomName(msg.room)) continue;
      sendChatSse(client.res, msg);
    } catch {
      chatClients.delete(client);
    }
  }
}

function readChatEntries() {
  if (!fs.existsSync(CHAT_PATH)) return [];
  const raw = fs.readFileSync(CHAT_PATH, "utf8").trim();
  if (!raw) return [];
  const lines = raw.split("\n");
  return lines
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function materializeChatMessages(entries, room = "all") {
  const targetRoom = normalizeRoomName(room);
  const byId = new Map();
  const ordered = [];

  for (const e of entries) {
    const type = String(e.type || "message");
    if (type !== "message") continue;
    const msg = {
      id: e.id,
      type: "message",
      agentId: e.agentId,
      agentName: e.agentName,
      identityProvider: e.identityProvider,
      identityMeta: e.identityMeta || {},
      room: normalizeRoomName(e.room || "general"),
      text: e.text,
      ts: e.ts,
      replyTo: e.replyTo || null,
      reactions: {},
      reactionUsers: {},
    };
    byId.set(msg.id, msg);
    ordered.push(msg);
  }

  for (const e of entries) {
    if (String(e.type || "") !== "reaction") continue;
    const msg = byId.get(e.messageId);
    if (!msg) continue;
    const emoji = String(e.emoji || "").trim();
    const agentId = String(e.agentId || "").trim();
    if (!emoji || !agentId) continue;
    const current = new Set(msg.reactionUsers[emoji] || []);
    if (current.has(agentId)) current.delete(agentId);
    else current.add(agentId);
    msg.reactionUsers[emoji] = [...current];
    msg.reactions[emoji] = msg.reactionUsers[emoji].length;
  }

  const roomFiltered = targetRoom === "all"
    ? ordered
    : ordered.filter((m) => normalizeRoomName(m.room || "general") === targetRoom);
  return roomFiltered;
}

function readChatMessages(limit = 100, room = "all") {
  const entries = readChatEntries();
  const filtered = materializeChatMessages(entries, room);
  return filtered.slice(-limit);
}

function readChatRooms(limit = 50) {
  const parsed = materializeChatMessages(readChatEntries(), "all");
  const byRoom = new Map();
  for (const m of parsed) {
    const room = normalizeRoomName(m.room || "general");
    const prev = byRoom.get(room) || {
      room,
      count: 0,
      lastTs: null,
      lastMessage: "",
      participants: new Set(),
    };
    prev.count += 1;
    prev.lastTs = m.ts || prev.lastTs;
    prev.lastMessage = m.text || prev.lastMessage;
    if (m.agentId) prev.participants.add(m.agentId);
    byRoom.set(room, prev);
  }
  return [...byRoom.values()]
    .map((r) => ({
      room: r.room,
      count: r.count,
      lastTs: r.lastTs,
      lastMessage: r.lastMessage,
      participants: r.participants.size,
    }))
    .sort((a, b) => String(b.lastTs || "").localeCompare(String(a.lastTs || "")))
    .slice(0, limit);
}

function appendChatMessage(msg) {
  fs.appendFileSync(CHAT_PATH, JSON.stringify(msg) + "\n");
}

function appendTelemetryEvent(evt) {
  fs.appendFileSync(EVENTS_PATH, JSON.stringify(evt) + "\n");
}

function sha256(input) {
  return createHash("sha256").update(String(input)).digest("hex");
}

function readInvites() {
  try {
    if (!fs.existsSync(INVITES_PATH)) return { invites: {} };
    const raw = fs.readFileSync(INVITES_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { invites: {} };
    if (!parsed.invites || typeof parsed.invites !== "object") return { invites: {} };
    return parsed;
  } catch {
    return { invites: {} };
  }
}

function writeInvites(data) {
  try {
    ensureDir(path.dirname(INVITES_PATH));
    fs.writeFileSync(INVITES_PATH, JSON.stringify(data, null, 2));
  } catch {
    // ignore write failures (best-effort)
  }
}

function mintInvite({ ttlMs = INVITE_TTL_MS, uses = 1 } = {}) {
  const safeUses = Math.max(1, Math.min(INVITE_MAX_USES, Number(uses) || 1));
  const safeTtl = Math.max(60_000, Math.min(7 * 24 * 60 * 60 * 1000, Number(ttlMs) || INVITE_TTL_MS));
  const token = `inv_${randomUUID().replace(/-/g, "")}`;
  const tokenHash = sha256(token);
  const now = Date.now();
  const invites = readInvites();
  invites.invites[tokenHash] = {
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + safeTtl).toISOString(),
    usesRemaining: safeUses,
  };
  writeInvites(invites);
  return { token, tokenHash, expiresAt: invites.invites[tokenHash].expiresAt, usesRemaining: safeUses };
}

function consumeInvite(inviteToken) {
  const token = String(inviteToken || "").trim();
  if (!token) return { ok: false, reason: "missing invite" };
  const tokenHash = sha256(token);
  const invites = readInvites();
  const row = invites.invites?.[tokenHash];
  if (!row) return { ok: false, reason: "invite not found" };
  const now = Date.now();
  const exp = new Date(row.expiresAt || 0).getTime();
  if (!exp || exp <= now) return { ok: false, reason: "invite expired" };
  const remaining = Number(row.usesRemaining || 0);
  if (remaining <= 0) return { ok: false, reason: "invite exhausted" };
  invites.invites[tokenHash] = { ...row, usesRemaining: remaining - 1, lastUsedAt: new Date(now).toISOString() };
  writeInvites(invites);
  return { ok: true };
}

function clientIpFromReq(req) {
  const xff = String(req.headers["x-forwarded-for"] || "").trim();
  if (xff) return xff.split(",")[0].trim();
  return String(req.socket?.remoteAddress || "").trim() || "unknown";
}

async function resolveChatAuth(req, body) {
  const agentId = body.agentId || req.headers["x-agent-id"] || "";
  const agentToken = body.agentToken || req.headers["x-agent-token"] || "";
  const identityToken = body.identityToken || req.headers["x-moltbook-identity"] || "";

  if (identityToken) {
    const identity = await verifyMoltbookIdentity(identityToken);
    if (!identity.verified) return { ok: false, status: 403, error: "identity verify failed", reason: identity.reason };
    const agent = identity.agent || {};
    return {
      ok: true,
      auth: {
        id: String(agent.name || agent.id || "moltbook-agent"),
        name: String(agent.name || agent.id || "Moltbook Agent"),
        provider: "moltbook",
        meta: {
          karma: Number(agent.karma || 0),
          claimed: Boolean(agent.is_claimed),
        },
      },
    };
  }

  if (!agentId || !agentToken) {
    return { ok: false, status: 401, error: "missing credentials: provide agentId+agentToken or identityToken" };
  }
  const verification = verifyClawbot({ agentId, agentToken });
  if (!verification.verified) {
    return { ok: false, status: 403, error: "not verified", reason: verification.reason };
  }
  return {
    ok: true,
    auth: {
      id: agentId,
      name: verification.agent?.name || agentId,
      provider: "clawbot",
      meta: {},
    },
  };
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

async function verifyMoltbookIdentity(identityToken) {
  const token = String(identityToken || "").trim();
  if (!token) return { verified: false, reason: "missing identity token" };
  if (!MOLTBOOK_APP_KEY) return { verified: false, reason: "MOLTBOOK_APP_KEY not configured on backend" };
  try {
    const r = await fetch(`${MOLTBOOK_API_BASE}/agents/verify-identity`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-moltbook-app-key": MOLTBOOK_APP_KEY,
      },
      body: JSON.stringify({ token }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return { verified: false, reason: data?.error || `identity verify failed (${r.status})` };
    if (!data?.valid || !data?.agent) return { verified: false, reason: "identity token invalid" };
    return { verified: true, agent: data.agent };
  } catch (err) {
    return { verified: false, reason: err.message || "identity verification request failed" };
  }
}

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, x-agent-id, x-agent-token, x-moltbook-identity, x-registration-key",
};

// ── Pod workspace helpers ────────────────────────────────────────

function findPodWorkspaceDir() {
  // Check paths in order: env var, ./pod-workspace, ./pod
  const envDir = process.env.APE_CLAW_POD_DIR;
  if (envDir) {
    const p = path.resolve(envDir);
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) return p;
  }
  const podWorkspace = path.join(ROOT, "pod-workspace");
  if (fs.existsSync(podWorkspace) && fs.statSync(podWorkspace).isDirectory()) return podWorkspace;
  const pod = path.join(ROOT, "pod");
  if (fs.existsSync(pod) && fs.statSync(pod).isDirectory()) return pod;
  return null;
}

function getPodStatus() {
  const workspacePath = findPodWorkspaceDir();
  if (!workspacePath) {
    return {
      ok: true,
      status: "not-initialized",
      workspacePath: null,
    };
  }

  const agentsMdPath = path.join(workspacePath, "AGENTS.md");
  const tasksPath = path.join(workspacePath, "memory", "active-tasks.md");
  const stopFlagPath = path.join(workspacePath, "stop.flag");
  const heartbeatPath = path.join(workspacePath, "state", "last-heartbeat.json");

  const hasAgentsMd = fs.existsSync(agentsMdPath);
  const hasTasks = fs.existsSync(tasksPath);
  const stopped = fs.existsSync(stopFlagPath);

  let lastHeartbeat = null;
  if (fs.existsSync(heartbeatPath)) {
    try {
      const raw = fs.readFileSync(heartbeatPath, "utf8");
      const data = JSON.parse(raw);
      lastHeartbeat = data?.timestamp || data?.ts || null;
    } catch {
      // ignore parse errors
    }
  }

  let status = "not-initialized";
  if (hasAgentsMd) {
    status = stopped ? "stopped" : "running";
  }

  return {
    ok: true,
    status,
    workspacePath,
    hasAgentsMd,
    hasTasks,
    stopped,
    lastHeartbeat,
  };
}

const server = http.createServer((req, res) => {
  if (!req.url) return res.end("bad request");
  const reqUrl = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = reqUrl.pathname;

  // ── CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    return res.end();
  }

  if (pathname === "/events") {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
      "access-control-allow-origin": "*",
    });
    res.write("\n");
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }
  if (pathname === "/events/backlog") return sendBacklog(res);
  if (pathname === "/api/allowlist") {
    getAllowlistWithIcons()
      .then((data) => {
        res.writeHead(200, {
          "content-type": "application/json; charset=utf-8",
          "access-control-allow-origin": "*",
        });
        res.end(JSON.stringify(data));
      })
      .catch((err) => {
        res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: err.message }));
      });
    return;
  }
  if (pathname === "/api/policy") {
    return serveJson(res, POLICY_PATH);
  }
  if (pathname === "/api/skillcards/user" && req.method === "GET") {
    try {
      const raw = JSON.parse(fs.readFileSync(SKILLCARDS_USER_INDEX_PATH, "utf8"));
      const skills = Array.isArray(raw?.skills) ? raw.skills : [];
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
      return res.end(JSON.stringify({ ok: true, skills }));
    } catch (err) {
      res.writeHead(500, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
      return res.end(JSON.stringify({ ok: false, error: err.message || "failed to load index" }));
    }
  }
  if (pathname === "/api/skills/search" && req.method === "GET") {
    try {
      const query = String(reqUrl.searchParams.get("q") || "").trim().toLowerCase();
      const sourceFilter = String(reqUrl.searchParams.get("source") || "").trim().toLowerCase();
      const vettedFilter = String(reqUrl.searchParams.get("vetted") || "").trim();
      const page = Math.max(1, Number(reqUrl.searchParams.get("page") || 1));
      const limit = Math.min(200, Math.max(1, Number(reqUrl.searchParams.get("limit") || 50)));

      let results = getMergedSkillIndex();

      // Filter by source
      if (sourceFilter && ["seed", "imported", "user"].includes(sourceFilter)) {
        results = results.filter((s) => s.source === sourceFilter);
      }

      // Filter by vetted
      if (vettedFilter === "1") {
        results = results.filter((s) => s.vettedOk === true);
      }

      // Filter by search query (case-insensitive substring match on name, slug, description)
      if (query) {
        results = results.filter((s) => {
          const name = String(s.name || "").toLowerCase();
          const slug = String(s.slug || "").toLowerCase();
          const desc = String(s.description || "").toLowerCase();
          return name.includes(query) || slug.includes(query) || desc.includes(query);
        });
      }

      // Paginate
      const total = results.length;
      const pages = Math.ceil(total / limit);
      const start = (page - 1) * limit;
      const end = start + limit;
      const paginatedResults = results.slice(start, end);

      res.writeHead(200, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
      return res.end(
        JSON.stringify({
          ok: true,
          total,
          page,
          limit,
          pages,
          results: paginatedResults,
        }),
      );
    } catch (err) {
      res.writeHead(500, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
      return res.end(JSON.stringify({ ok: false, error: err.message || "search failed" }));
    }
  }
  if (pathname === "/api/skills/stats" && req.method === "GET") {
    try {
      const all = getMergedSkillIndex();
      const seed = all.filter((s) => s.source === "seed").length;
      const imported = all.filter((s) => s.source === "imported").length;
      const user = all.filter((s) => s.source === "user").length;
      const vetted = all.filter((s) => s.vettedOk === true).length;
      const onchain = all.filter((s) => s.onchainTokenId != null).length;
      let recent = all.filter((s) => s.addedAt).sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
      if (recent.length === 0) recent = all.slice(-20).reverse();
      recent = recent.slice(0, 10).map((s) => ({
        name: s.name, slug: s.slug, source: s.source, addedAt: s.addedAt,
        riskTier: s.riskTier, description: String(s.description || "").slice(0, 150),
        onchainTokenId: s.onchainTokenId ?? null,
      }));
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
      return res.end(JSON.stringify({ ok: true, total: all.length, seed, imported, user, vetted, onchain, recent }));
    } catch (err) {
      res.writeHead(500, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
      return res.end(JSON.stringify({ ok: false, error: err.message || "stats failed" }));
    }
  }
  if (pathname === "/api/skillcards/user/auth-check" && req.method === "GET") {
    const auth = requireSkillWriteAuth(req);
    res.writeHead(auth.ok ? 200 : 401, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
    return res.end(JSON.stringify({
      ok: auth.ok,
      mode: auth.mode,
      agentId: auth.agentId,
    }));
  }
  if (pathname === "/api/skillcards/user/add" && req.method === "POST") {
    const auth = requireSkillWriteAuth(req);
    if (!auth.ok) {
      res.writeHead(401, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
      return res.end(JSON.stringify({ ok: false, error: "unauthorized (set x-agent-id/x-agent-token or x-registration-key)" }));
    }
    readRequestBody(req).then((body) => {
      const skillcard = body?.skillcard || body?.card || body;
      if (!skillcard || typeof skillcard !== "object") throw new Error("missing skillcard object");

      const name = String(skillcard.name || "").trim();
      if (!name) throw new Error("skillcard.name required");
      const slug = toSlug(skillcard.slug || name);
      if (!slug) throw new Error("skillcard.slug required");

      const version = safeVersion(skillcard.version || "1.0.0");
      if (!version) throw new Error("skillcard.version invalid (expected semver-ish)");

      const desc = String(skillcard.description || "").trim();
      const riskTierRaw = Number(skillcard?.constraints?.riskTier ?? skillcard?.riskTier ?? 2);
      const riskTier = Number.isFinite(riskTierRaw) ? Math.max(1, Math.min(3, Math.round(riskTierRaw))) : 2;
      const createdAt = new Date().toISOString();
      const sourceUrl = String(body?.sourceUrl || skillcard?.provenance?.sourceUrl || "").trim();

      // Persist SkillCard JSON.
      const fileName = `${slug}.v${version}.json`;
      const filePath = path.join(SKILLCARDS_USER_DIR, fileName);
      const payload = { ...skillcard, slug, version, name, description: desc };
      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));

      // Update index (append-only by default; replace if exact file exists).
      const idx = JSON.parse(fs.readFileSync(SKILLCARDS_USER_INDEX_PATH, "utf8"));
      const skills = Array.isArray(idx?.skills) ? idx.skills : [];
      const entry = {
        fileName,
        name,
        slug,
        version,
        description: desc,
        riskTier,
        sourceUrl,
        createdAt,
        addedBy: auth.mode,
        addedByAgentId: auth.agentId,
      };
      const next = skills.filter((s) => String(s?.fileName || "") !== fileName);
      next.unshift(entry);
      atomicWriteJson(SKILLCARDS_USER_INDEX_PATH, { skills: next });

      res.writeHead(200, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
      return res.end(JSON.stringify({ ok: true, entry, fileHref: `/skillcards/user/${encodeURIComponent(fileName)}` }));
    }).catch((err) => {
      res.writeHead(400, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
      return res.end(JSON.stringify({ ok: false, error: err.message || "invalid request" }));
    });
    return;
  }
  if (pathname === "/api/skillcards/user/delete" && req.method === "POST") {
    const auth = requireSkillWriteAuth(req);
    if (!auth.ok) {
      res.writeHead(401, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
      return res.end(JSON.stringify({ ok: false, error: "unauthorized" }));
    }
    readRequestBody(req).then((body) => {
      const fileName = String(body?.fileName || "").trim();
      if (!fileName || fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
        throw new Error("invalid fileName");
      }
      const filePath = path.join(SKILLCARDS_USER_DIR, fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      const idx = JSON.parse(fs.readFileSync(SKILLCARDS_USER_INDEX_PATH, "utf8"));
      const skills = Array.isArray(idx?.skills) ? idx.skills : [];
      const next = skills.filter((s) => String(s?.fileName || "") !== fileName);
      atomicWriteJson(SKILLCARDS_USER_INDEX_PATH, { skills: next });
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
      return res.end(JSON.stringify({ ok: true }));
    }).catch((err) => {
      res.writeHead(400, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
      return res.end(JSON.stringify({ ok: false, error: err.message || "invalid request" }));
    });
    return;
  }
  if (pathname === "/api/skillcards/user/mark-onchain" && req.method === "POST") {
    const auth = requireSkillWriteAuth(req);
    if (!auth.ok) {
      res.writeHead(401, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
      return res.end(JSON.stringify({ ok: false, error: "unauthorized" }));
    }
    readRequestBody(req).then((body) => {
      const fileName = String(body?.fileName || "").trim();
      if (!fileName || fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
        throw new Error("invalid fileName");
      }
      const skillIdNum = Number(body?.skillId);
      if (!Number.isFinite(skillIdNum) || skillIdNum <= 0) throw new Error("invalid skillId");
      const txHash = String(body?.txHash || "").trim();
      const idx = JSON.parse(fs.readFileSync(SKILLCARDS_USER_INDEX_PATH, "utf8"));
      const skills = Array.isArray(idx?.skills) ? idx.skills : [];
      let found = false;
      const next = skills.map((s) => {
        if (String(s?.fileName || "") !== fileName) return s;
        found = true;
        return {
          ...s,
          onchain: {
            skillId: Math.floor(skillIdNum),
            txHash,
            markedAt: new Date().toISOString(),
          },
        };
      });
      if (!found) throw new Error("skill not found");
      atomicWriteJson(SKILLCARDS_USER_INDEX_PATH, { skills: next });
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
      return res.end(JSON.stringify({ ok: true }));
    }).catch((err) => {
      res.writeHead(400, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
      return res.end(JSON.stringify({ ok: false, error: err.message || "invalid request" }));
    });
    return;
  }

  // Read-only v2 helper: fetch a receipt by traceId (no signing).
  if (pathname === "/api/v2/receipt/get" && req.method === "GET") {
    const traceId = String(reqUrl.searchParams.get("traceId") || reqUrl.searchParams.get("trace") || "").trim();
    if (!traceId) {
      res.writeHead(400, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
      return res.end(JSON.stringify({ ok: false, error: "missing traceId" }));
    }
    const cfg = resolveV2ReceiptReadConfig();
    if (!cfg.ok) {
      res.writeHead(501, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
      return res.end(JSON.stringify({ ok: false, error: cfg.reason, inferredRpc: cfg.inferredRpc || false }));
    }
    (async () => {
      const publicClient = createPublicClient({ transport: viemHttp(cfg.rpcUrl) });
      const receipts = getContract({
        address: cfg.receiptsAddress,
        abi: ReceiptRegistry_ABI,
        client: { public: publicClient },
      });
      const traceIdHash = keccak256(toHex(traceId));
      const isRecorded = await receipts.read.isRecorded([traceIdHash]);
      const receipt = isRecorded ? await receipts.read.getReceipt([traceIdHash]) : null;
      const result = {
        ok: true,
        traceId,
        traceIdHash,
        isRecorded: Boolean(isRecorded),
        receipt,
      };
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
      // viem returns bigint for uints; JSON.stringify would throw.
      res.end(JSON.stringify(result, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
    })().catch((err) => {
      // Avoid crashing the whole server if the client disconnected or we already replied.
      if (res.headersSent || res.writableEnded) return;
      res.writeHead(502, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
      res.end(JSON.stringify({ ok: false, error: err?.message || "receipt read failed" }));
    });
    return;
  }

  // Read-only v2 helper: return latest known deployment record + receipt read config.
  // This is used to auto-fill UI inputs in local/dev without copy-pasting addresses.
  if (pathname === "/api/v2/config" && req.method === "GET") {
    const rec = resolveV2DeploymentRecord();
    const v2Cfg = resolveV2ReceiptReadConfig();
    res.writeHead(200, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
    return res.end(JSON.stringify({
      ok: true,
      deployment: rec,
      receiptsRead: v2Cfg,
      // Include podVault and agentAccount at top level for convenience
      podVault: rec?.podVault || null,
      agentAccount: rec?.agentAccount || null,
      // Also include as record for backward compatibility
      record: rec,
      ts: new Date().toISOString(),
    }, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
  }

  // ── Pod status endpoint ────────────────────────────────────────
  if (pathname === "/api/pod/status" && req.method === "GET") {
    const status = getPodStatus();
    res.writeHead(200, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
    return res.end(JSON.stringify(status));
  }

  // ── Pod stop endpoint ─────────────────────────────────────────
  if (pathname === "/api/pod/stop" && req.method === "POST") {
    const auth = requireSkillWriteAuth(req);
    if (!auth.ok) {
      res.writeHead(401, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
      return res.end(JSON.stringify({ ok: false, error: "unauthorized (set x-registration-key or x-agent-id/x-agent-token)" }));
    }
    const workspacePath = findPodWorkspaceDir();
    if (!workspacePath) {
      res.writeHead(404, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
      return res.end(JSON.stringify({ ok: false, error: "pod workspace not found" }));
    }
    const stopFlagPath = path.join(workspacePath, "stop.flag");
    try {
      ensureDir(workspacePath);
      fs.writeFileSync(stopFlagPath, new Date().toISOString() + "\n");
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
      return res.end(JSON.stringify({ ok: true, action: "stop", flagPath: stopFlagPath }));
    } catch (err) {
      res.writeHead(500, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
      return res.end(JSON.stringify({ ok: false, error: err.message || "failed to create stop flag" }));
    }
  }

  if (pathname === "/api/health") {
    const v2Cfg = resolveV2ReceiptReadConfig();
    const payload = {
      ok: true,
      service: "ape-claw-telemetry",
      port: PORT,
      root: ROOT,
      paths: {
        events: EVENTS_PATH,
        chat: CHAT_PATH,
        policy: POLICY_PATH,
        allowlist: ALLOWLIST_PATH,
        clawbots: CLAWBOTS_PATH,
        invites: INVITES_PATH,
        skillcardsUserIndex: SKILLCARDS_USER_INDEX_PATH,
      },
      counts: {
        eventsBytes: fs.existsSync(EVENTS_PATH) ? fs.statSync(EVENTS_PATH).size : 0,
        chatBytes: fs.existsSync(CHAT_PATH) ? fs.statSync(CHAT_PATH).size : 0,
      },
      identity: {
        moltbookEnabled: Boolean(MOLTBOOK_APP_KEY),
        moltbookApiBase: MOLTBOOK_API_BASE,
        registrationEnabled: Boolean(REGISTRATION_KEY),
        openRegistration: OPEN_REGISTRATION,
        registrationCooldownMs: REGISTRATION_COOLDOWN_MS,
        inviteTtlMs: INVITE_TTL_MS,
        inviteMaxUses: INVITE_MAX_USES,
      },
      v2: {
        rpcUrl: v2Cfg.ok ? v2Cfg.rpcUrl : (v2Cfg.rpcUrl || null),
        receiptRegistry: v2Cfg.ok ? v2Cfg.receiptsAddress : (v2Cfg.receiptsAddress || null),
        inferredRpc: Boolean(v2Cfg.inferredRpc),
        configured: Boolean(v2Cfg.ok),
      },
      ts: new Date().toISOString(),
    };
    res.writeHead(200, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
    return res.end(JSON.stringify(payload));
  }
  if (pathname === "/api/clawbots") {
    if (!fs.existsSync(CLAWBOTS_PATH)) {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" });
      return res.end(JSON.stringify({ count: 0, clawbots: [], sharedKeyConfigured: false }));
    }
    try {
      const raw = JSON.parse(fs.readFileSync(CLAWBOTS_PATH, "utf8"));
      const agents = raw.agents || {};
      const clawbots = Object.entries(agents).map(([id, a]) => ({
        agentId: id,
        name: a.name || id,
        enabled: a.enabled !== false,
        createdAt: a.createdAt || null,
      }));
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" });
      return res.end(JSON.stringify({ count: clawbots.length, clawbots, sharedKeyConfigured: Boolean(raw.sharedOpenseaApiKey) }));
    } catch (err) {
      res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // Serve user SkillCard JSON under a stable, public path (read-only).
  if (pathname.startsWith("/skillcards/user/") && req.method === "GET") {
    const fileName = decodeURIComponent(String(pathname || "").slice("/skillcards/user/".length));
    if (!fileName || fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
      res.writeHead(400, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
      return res.end(JSON.stringify({ error: "invalid file" }));
    }
    const filePath = path.join(SKILLCARDS_USER_DIR, fileName);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      res.writeHead(404, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
      return res.end(JSON.stringify({ error: "not found" }));
    }
    res.writeHead(200, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
    return fs.createReadStream(filePath).pipe(res);
  }
  if (pathname === "/api/clawbots/verify" && req.method === "POST") {
    // Verify credentials against backend clawbots.json (server-authoritative).
    // Returns shared OpenSea key only for verified bots (if configured).
    const headerAgentId = String(req.headers["x-agent-id"] || "").trim();
    const headerAgentToken = String(req.headers["x-agent-token"] || "").trim();
    if (!headerAgentId || !headerAgentToken) {
      res.writeHead(401, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
      return res.end(JSON.stringify({ ok: false, error: "missing credentials: x-agent-id + x-agent-token are required" }));
    }
    const verification = verifyClawbot({ agentId: headerAgentId, agentToken: headerAgentToken });
    if (!verification.verified) {
      res.writeHead(403, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
      return res.end(JSON.stringify({ ok: false, error: "not verified", reason: verification.reason }));
    }
    res.writeHead(200, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
    return res.end(JSON.stringify({
      ok: true,
      verified: true,
      agent: verification.agent,
      sharedOpenseaApiKey: verification.sharedOpenseaApiKey || "",
    }));
  }
  if (pathname === "/api/invites/create" && req.method === "POST") {
    readRequestBody(req).then((body) => {
      if (!REGISTRATION_KEY) {
        res.writeHead(503, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: "invite creation disabled: backend missing APE_CLAW_REGISTRATION_KEY" }));
      }
      const providedKey = String(req.headers["x-registration-key"] || "").trim();
      if (!providedKey || providedKey !== REGISTRATION_KEY) {
        res.writeHead(403, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: "invalid registration key" }));
      }
      const ttlMs = body?.ttlMs;
      const uses = body?.uses;
      const invite = mintInvite({ ttlMs, uses });
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
      return res.end(JSON.stringify({
        ok: true,
        invite: invite.token,
        expiresAt: invite.expiresAt,
        usesRemaining: invite.usesRemaining,
        note: "Share this invite privately. It can be redeemed via clawbot register --invite <token>.",
      }));
    }).catch(() => {
      res.writeHead(400, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
      return res.end(JSON.stringify({ error: "invalid JSON body" }));
    });
    return;
  }
  if (pathname === "/api/clawbots/register" && req.method === "POST") {
    readRequestBody(req).then((body) => {
      const inviteToken = String(body?.invite || "").trim();
      const inviteOk = inviteToken ? consumeInvite(inviteToken) : { ok: false, reason: "missing invite" };

      if (!REGISTRATION_KEY && !OPEN_REGISTRATION && !inviteOk.ok) {
        res.writeHead(503, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
        return res.end(JSON.stringify({
          error: "registration is disabled: use an invite, set APE_CLAW_REGISTRATION_KEY, or enable APE_CLAW_OPEN_REGISTRATION",
        }));
      }
      const hasValidKey = (() => {
        if (!REGISTRATION_KEY) return false;
        const providedKey = String(req.headers["x-registration-key"] || "").trim();
        return Boolean(providedKey) && providedKey === REGISTRATION_KEY;
      })();
      if (!OPEN_REGISTRATION && !hasValidKey && !inviteOk.ok) {
        res.writeHead(403, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: "registration not allowed (missing invite or invalid registration key)" }));
      }
      if (OPEN_REGISTRATION && !hasValidKey && REGISTRATION_COOLDOWN_MS > 0) {
        const ip = clientIpFromReq(req);
        const now = Date.now();
        const last = Number(registrationByIp.get(ip) || 0);
        if (last && now - last < REGISTRATION_COOLDOWN_MS) {
          const waitMs = REGISTRATION_COOLDOWN_MS - (now - last);
          res.writeHead(429, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
          return res.end(JSON.stringify({
            error: "registration rate limited",
            retryAfterMs: waitMs,
          }));
        }
        registrationByIp.set(ip, now);
      }

      const agentId = String(body?.agentId || "").trim();
      const displayName = String(body?.name || agentId || "").trim();
      if (!agentId) {
        res.writeHead(400, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: "agentId is required" }));
      }
      try {
        const reg = registerClawbot({ agentId, displayName });
        const result = {
          registered: true,
          agentId: reg.agentId,
          name: reg.displayName,
          token: reg.token,
          note: "Save this token — it is shown only once. Use as APE_CLAW_AGENT_TOKEN or --agent-token.",
        };
        res.writeHead(200, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
        return res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: err.message || "registration failed" }));
      }
    }).catch(() => {
      res.writeHead(400, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
      return res.end(JSON.stringify({ error: "invalid JSON body" }));
    });
    return;
  }
  if (pathname === "/api/events" && req.method === "POST") {
    readRequestBody(req).then((body) => {
      const eventType = String(body?.eventType || "").trim();
      if (!eventType) {
        res.writeHead(400, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: "eventType is required" }));
      }

      const headerAgentId = String(req.headers["x-agent-id"] || "").trim();
      const headerAgentToken = String(req.headers["x-agent-token"] || "").trim();
      if (!headerAgentId || !headerAgentToken) {
        res.writeHead(401, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: "missing credentials: x-agent-id + x-agent-token are required" }));
      }
      const verification = verifyClawbot({ agentId: headerAgentId, agentToken: headerAgentToken });
      if (!verification.verified) {
        res.writeHead(403, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: "not verified", reason: verification.reason }));
      }

      const evt = {
        v: Number(body?.v || 1),
        ts:
          typeof body?.ts === "string"
            ? body.ts
            : (typeof body?.ts === "number" && Number.isFinite(body.ts))
              ? new Date(body.ts * 1000).toISOString()
              : new Date().toISOString(),
        eventType,
        agentId: headerAgentId,
        sessionId: String(body?.sessionId || "remote-session"),
        traceId: String(body?.traceId || `trace_${Date.now()}`),
        command: String(body?.command || ""),
        dryRun: Boolean(body?.dryRun),
        chainId: Number(body?.chainId || 33139),
        payload: (body?.payload || body?.data) && typeof (body?.payload || body?.data) === "object" ? (body?.payload || body?.data) : {},
        result: body?.result && typeof body.result === "object" ? body.result : {},
        ok: body?.ok !== false,
        error: body?.error || null,
        ...(body?.source ? { source: String(body.source) } : {}),
      };
      appendTelemetryEvent(evt);
      for (const c of clients) sendSse(c, evt);

      res.writeHead(200, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
      return res.end(JSON.stringify({ ok: true, event: evt }));
    }).catch(() => {
      res.writeHead(400, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
      return res.end(JSON.stringify({ error: "invalid JSON body" }));
    });
    return;
  }
  // ── Chat SSE stream ────────────────────────────────
  if (pathname === "/api/chat/stream") {
    const room = normalizeRoomName(reqUrl.searchParams.get("room") || "all");
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
      ...CORS_HEADERS,
    });
    res.write("\n");
    const client = { res, room };
    chatClients.add(client);
    req.on("close", () => chatClients.delete(client));
    return;
  }

  // ── Chat: GET recent messages ─────────────────────
  if (pathname === "/api/chat" && req.method === "GET") {
    const room = normalizeRoomName(reqUrl.searchParams.get("room") || "all");
    const limit = Math.max(1, Math.min(500, Number(reqUrl.searchParams.get("limit") || 100)));
    const messages = readChatMessages(limit, room);
    res.writeHead(200, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
    return res.end(JSON.stringify({ room, limit, messages }));
  }

  // ── Chat: GET room directory ──────────────────────
  if (pathname === "/api/chat/rooms" && req.method === "GET") {
    const limit = Math.max(1, Math.min(200, Number(reqUrl.searchParams.get("limit") || 50)));
    const rooms = readChatRooms(limit);
    res.writeHead(200, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
    return res.end(JSON.stringify({ count: rooms.length, rooms }));
  }

  // ── Chat: POST new message ────────────────────────
  if (pathname === "/api/chat" && req.method === "POST") {
    readRequestBody(req).then(async (body) => {
      const room = normalizeRoomName(body.room || reqUrl.searchParams.get("room") || "general");
      const text = String(body.text || "").trim();
      const replyTo = String(body.replyTo || "").trim();

      if (!text || text.length > 500) {
        res.writeHead(400, { "content-type": "application/json", ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: "message must be 1-500 characters" }));
      }
      const authRes = await resolveChatAuth(req, body);
      if (!authRes.ok) {
        res.writeHead(authRes.status || 403, { "content-type": "application/json", ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: authRes.error, reason: authRes.reason }));
      }
      const auth = authRes.auth;

      if (replyTo) {
        const existing = materializeChatMessages(readChatEntries(), room);
        const parent = existing.find((m) => m.id === replyTo);
        if (!parent) {
          res.writeHead(400, { "content-type": "application/json", ...CORS_HEADERS });
          return res.end(JSON.stringify({ error: "reply target not found in this room" }));
        }
      }

      const msg = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: "message",
        agentId: auth.id,
        agentName: auth.name,
        identityProvider: auth.provider,
        identityMeta: auth.meta,
        room,
        text,
        replyTo: replyTo || null,
        reactions: {},
        reactionUsers: {},
        ts: new Date().toISOString(),
      };

      appendChatMessage(msg);
      broadcastChat(msg);

      res.writeHead(200, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
      return res.end(JSON.stringify({ ok: true, message: msg }));
    }).catch((err) => {
      res.writeHead(400, { "content-type": "application/json", ...CORS_HEADERS });
      return res.end(JSON.stringify({ error: "invalid JSON body" }));
    });
    return;
  }

  // ── Chat: POST reaction toggle ─────────────────────
  if (pathname === "/api/chat/react" && req.method === "POST") {
    readRequestBody(req).then(async (body) => {
      const room = normalizeRoomName(body.room || reqUrl.searchParams.get("room") || "general");
      const messageId = String(body.messageId || "").trim();
      const emoji = String(body.emoji || "").trim().slice(0, 8);
      if (!messageId || !emoji) {
        res.writeHead(400, { "content-type": "application/json", ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: "messageId and emoji are required" }));
      }

      const authRes = await resolveChatAuth(req, body);
      if (!authRes.ok) {
        res.writeHead(authRes.status || 403, { "content-type": "application/json", ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: authRes.error, reason: authRes.reason }));
      }
      const auth = authRes.auth;

      const existing = materializeChatMessages(readChatEntries(), room);
      const parent = existing.find((m) => m.id === messageId);
      if (!parent) {
        res.writeHead(404, { "content-type": "application/json", ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: "message not found in this room" }));
      }

      const evt = {
        id: `react_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: "reaction",
        room,
        messageId,
        emoji,
        agentId: auth.id,
        agentName: auth.name,
        ts: new Date().toISOString(),
      };
      appendChatMessage(evt);
      broadcastChat(evt);
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
      return res.end(JSON.stringify({ ok: true, reaction: evt }));
    }).catch(() => {
      res.writeHead(400, { "content-type": "application/json", ...CORS_HEADERS });
      return res.end(JSON.stringify({ error: "invalid JSON body" }));
    });
    return;
  }

  // ── Local UX rewrites (match Vercel routes) ───────────
  // In production, Vercel rewrites /ui, /docs, /pod, /skills to static HTML files.
  // For local dev, implement the same behavior so URLs are consistent.
  const REWRITES = {
    "/ui": "/ui/index.html",
    "/app": "/ui/index.html",
    "/docs": "/ui/docs.html",
    "/pod": "/ui/pod.html",
    "/skills": "/ui/skills.html",
    "/favicon-lobster.png": "/ui/favicon-lobster.png",
  };
  const cleanPath = String(pathname || "").replace(/\/+$/, "").toLowerCase() || pathname;
  const rewrite = REWRITES[pathname] || REWRITES[String(pathname || "").replace(/\/+$/, "")] || REWRITES[cleanPath] || "";
  if (rewrite) {
    const p = path.join(ROOT, rewrite);
    if (!fs.existsSync(p)) {
      res.writeHead(404);
      return res.end(`missing: ${rewrite}`);
    }
    const ext = path.extname(p).toLowerCase();
    const mime = ext === ".html" ? "text/html; charset=utf-8"
      : ext === ".png" ? "image/png"
        : "application/octet-stream";
    res.writeHead(200, { "content-type": mime });
    return fs.createReadStream(p).pipe(res);
  }

  if (pathname === "/" || pathname === "/index.html") {
    // Prefer the marketing landing page at repo root.
    const landingPath = path.join(ROOT, "index.html");
    const p = fs.existsSync(landingPath) ? landingPath : UI_PATH;
    if (!fs.existsSync(p)) {
      res.writeHead(404);
      return res.end("index.html not found");
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return fs.createReadStream(p).pipe(res);
  }

  // ── Static file serving for local dev ────────────────
  const MIME_TYPES = {
    ".html": "text/html", ".css": "text/css", ".js": "application/javascript",
    ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
    ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webp": "image/webp",
    ".md": "text/plain; charset=utf-8", ".txt": "text/plain; charset=utf-8",
    ".woff2": "font/woff2",
  };
  const safePath = decodeURIComponent(pathname);
  if (!safePath.includes("..") && !safePath.includes("~")) {
    const filePath = path.join(ROOT, safePath);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const mime = MIME_TYPES[ext] || "application/octet-stream";
      res.writeHead(200, { "content-type": mime });
      return fs.createReadStream(filePath).pipe(res);
    }
  }

  res.writeHead(404);
  res.end("not found");
});

let lastSize = fs.statSync(EVENTS_PATH).size;
fs.watchFile(EVENTS_PATH, { interval: 500 }, () => {
  const stat = fs.statSync(EVENTS_PATH);
  if (stat.size <= lastSize) return;
  const fd = fs.openSync(EVENTS_PATH, "r");
  const buf = Buffer.alloc(stat.size - lastSize);
  fs.readSync(fd, buf, 0, buf.length, lastSize);
  fs.closeSync(fd);
  lastSize = stat.size;
  const chunk = buf.toString("utf8");
  const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    try {
      const evt = JSON.parse(line);
      for (const c of clients) sendSse(c, evt);
    } catch {
      // ignore malformed lines
    }
  }
});

server.listen(PORT, BIND_HOST || undefined, () => {
  console.log(`ape-claw telemetry server listening on http://localhost:${PORT}`);
  console.log(`SSE stream: http://localhost:${PORT}/events`);
});

