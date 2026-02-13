import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EVENTS_PATH, ALLOWLIST_PATH, POLICY_PATH, OPENSEA_OVERRIDES_PATH, CLAWBOTS_PATH, CHAT_PATH } from "./lib/paths.mjs";
import { ensureDir } from "./lib/io.mjs";
import { verifyClawbot } from "./lib/clawbots.mjs";

const PORT = Number(process.env.APE_CLAW_UI_PORT || 8787);
const ROOT = process.cwd();
const UI_PATH = path.join(ROOT, "ui", "index.html");
const clients = new Set();
const OPENSEA_API_BASE = "https://api.opensea.io/api/v2";
const ICON_CACHE_TTL_MS = 10 * 60 * 1000;
let allowlistIconCache = { expiresAt: 0, data: null, inFlight: null };

ensureDir(path.dirname(EVENTS_PATH));
if (!fs.existsSync(EVENTS_PATH)) fs.writeFileSync(EVENTS_PATH, "");
if (!fs.existsSync(CHAT_PATH)) fs.writeFileSync(CHAT_PATH, "");

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
  res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
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

const MAX_CHAT_MESSAGES = 200;
const chatClients = new Set();

function sendChatSse(res, msg) {
  res.write(`data: ${JSON.stringify(msg)}\n\n`);
}

function broadcastChat(msg) {
  for (const c of chatClients) {
    try { sendChatSse(c, msg); } catch { chatClients.delete(c); }
  }
}

function readChatMessages(limit = 100) {
  if (!fs.existsSync(CHAT_PATH)) return [];
  const raw = fs.readFileSync(CHAT_PATH, "utf8").trim();
  if (!raw) return [];
  const lines = raw.split("\n");
  return lines.slice(-limit).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

function appendChatMessage(msg) {
  fs.appendFileSync(CHAT_PATH, JSON.stringify(msg) + "\n");
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

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, x-agent-id, x-agent-token",
};

const server = http.createServer((req, res) => {
  if (!req.url) return res.end("bad request");

  // ── CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    return res.end();
  }

  if (req.url === "/events") {
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
  if (req.url === "/events/backlog") return sendBacklog(res);
  if (req.url === "/api/allowlist") {
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
  if (req.url === "/api/policy") {
    return serveJson(res, POLICY_PATH);
  }
  if (req.url === "/api/clawbots") {
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
  // ── Chat SSE stream ────────────────────────────────
  if (req.url === "/api/chat/stream") {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
      ...CORS_HEADERS,
    });
    res.write("\n");
    chatClients.add(res);
    req.on("close", () => chatClients.delete(res));
    return;
  }

  // ── Chat: GET recent messages ─────────────────────
  if (req.url === "/api/chat" && req.method === "GET") {
    const messages = readChatMessages(100);
    res.writeHead(200, { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS });
    return res.end(JSON.stringify({ messages }));
  }

  // ── Chat: POST new message ────────────────────────
  if (req.url === "/api/chat" && req.method === "POST") {
    readRequestBody(req).then((body) => {
      const agentId = body.agentId || req.headers["x-agent-id"] || "";
      const agentToken = body.agentToken || req.headers["x-agent-token"] || "";
      const text = String(body.text || "").trim();

      if (!text || text.length > 500) {
        res.writeHead(400, { "content-type": "application/json", ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: "message must be 1-500 characters" }));
      }
      if (!agentId || !agentToken) {
        res.writeHead(401, { "content-type": "application/json", ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: "missing agentId or agentToken" }));
      }

      const verification = verifyClawbot({ agentId, agentToken });
      if (!verification.verified) {
        res.writeHead(403, { "content-type": "application/json", ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: "not verified", reason: verification.reason }));
      }

      const msg = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        agentId,
        agentName: verification.agent?.name || agentId,
        text,
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

  if (req.url === "/" || req.url === "/index.html") {
    if (!fs.existsSync(UI_PATH)) {
      res.writeHead(404);
      return res.end("ui/index.html not found");
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return fs.createReadStream(UI_PATH).pipe(res);
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

server.listen(PORT, () => {
  console.log(`ape-claw telemetry server listening on http://localhost:${PORT}`);
  console.log(`SSE stream: http://localhost:${PORT}/events`);
});

