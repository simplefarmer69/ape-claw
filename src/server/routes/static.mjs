/**
 * Routes: static file serving and local UX rewrites
 */

import fs from "node:fs";
import path from "node:path";
import { ROOT as PROJECT_ROOT, POLICY_PATH, ALLOWLIST_PATH, OPENSEA_OVERRIDES_PATH } from "../../lib/paths.mjs";

const OPENSEA_API_BASE = "https://api.opensea.io/api/v2";
const ICON_CACHE_TTL_MS = 10 * 60 * 1000;
let allowlistIconCache = { expiresAt: 0, data: null, inFlight: null };

const REWRITES = {
  "/ui": "/ui/index.html", "/app": "/ui/index.html",
  "/docs": "/ui/docs.html", "/pod": "/ui/pod.html", "/skills": "/ui/skills.html", "/forge": "/ui/forge/index.html",
  "/favicon-lobster.png": "/ui/favicon-lobster.png",
  "/ui/favicon.svg": "/ui/favicon.svg", "/ui/favicon-32.png": "/ui/favicon-32.png",
  "/ui/favicon-180.png": "/ui/favicon-180.png", "/ui/favicon-192.png": "/ui/favicon-192.png",
};

const MIME_TYPES = {
  ".html": "text/html", ".css": "text/css", ".js": "application/javascript",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webp": "image/webp",
  ".md": "text/plain; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".woff2": "font/woff2",
};

function toSlug(input) {
  return String(input || "").toLowerCase().trim()
    .replace(/®/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function unique(items) { return [...new Set(items.filter(Boolean))]; }
function buildSlugCandidates(item, overrides = {}) {
  const raw = String(item?.name || "");
  const base = toSlug(raw);
  const fromOverride = overrides[raw] || overrides[base] || [];
  return unique([
    item?.slug, base, base.replace(/-on-apechain$/, ""), base.replace(/-on-ape$/, ""),
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
  return c?.image_url || c?.imageUrl || c?.banner_image_url || c?.bannerImageUrl || null;
}
async function resolveCollectionIcon(item, headers, overrides) {
  const candidates = buildSlugCandidates(item, overrides);
  for (const slug of candidates) {
    try {
      const data = await fetchJson(`${OPENSEA_API_BASE}/collections/${encodeURIComponent(slug)}`, headers);
      const imageUrl = extractCollectionImage(data);
      if (imageUrl) return { imageUrl, openseaSlug: slug };
    } catch {}
    try {
      const nftData = await fetchJson(`${OPENSEA_API_BASE}/collection/${encodeURIComponent(slug)}/nfts?limit=1`, headers);
      const first = Array.isArray(nftData?.nfts) ? nftData.nfts[0] : null;
      const imageUrl = first?.image_url || first?.display_image_url || first?.imageUrl || null;
      if (imageUrl) return { imageUrl, openseaSlug: slug };
    } catch {}
  }
  return { imageUrl: null, openseaSlug: null };
}
async function mapWithConcurrency(items, limit, mapper) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() { while (i < items.length) { const idx = i++; out[idx] = await mapper(items[idx], idx); } }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () => worker()));
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
      try { overrides = JSON.parse(fs.readFileSync(OPENSEA_OVERRIDES_PATH, "utf8")); } catch { overrides = {}; }
    }
    const headers = { "x-api-key": key, accept: "application/json" };
    const enriched = await mapWithConcurrency(allowlist, 8, async (item) => {
      const icon = await resolveCollectionIcon(item, headers, overrides);
      return { ...item, imageUrl: icon.imageUrl, openseaSlug: icon.openseaSlug || item.slug || null };
    });
    allowlistIconCache = { expiresAt: Date.now() + ICON_CACHE_TTL_MS, data: enriched, inFlight: null };
    return enriched;
  })();
  try { return await allowlistIconCache.inFlight; } finally {
    if (allowlistIconCache.inFlight && allowlistIconCache.expiresAt < Date.now()) allowlistIconCache.inFlight = null;
  }
}

export function handleAllowlist(req, res) {
  getAllowlistWithIcons()
    .then((data) => {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(data));
    })
    .catch((err) => {
      res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: err.message }));
    });
}

export function handlePolicy(req, res) {
  if (!fs.existsSync(POLICY_PATH)) {
    res.writeHead(404, { "content-type": "application/json" });
    return res.end(JSON.stringify({ error: "not found" }));
  }
  const raw = fs.readFileSync(POLICY_PATH, "utf8");
  res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  return res.end(raw);
}

export function handleRewrite(req, res, pathname) {
  const cleanPath = String(pathname || "").replace(/\/+$/, "").toLowerCase() || pathname;
  const rewrite = REWRITES[pathname] || REWRITES[String(pathname || "").replace(/\/+$/, "")] || REWRITES[cleanPath] || "";
  if (!rewrite) return false;
  const p = path.join(PROJECT_ROOT, rewrite);
  if (!fs.existsSync(p)) { res.writeHead(404); res.end(`missing: ${rewrite}`); return true; }
  const ext = path.extname(p).toLowerCase();
  const mime = MIME_TYPES[ext] || "application/octet-stream";
  const headers = { "content-type": mime };
  if (ext === ".html" || ext === ".js" || ext === ".css") {
    headers["cache-control"] = "no-cache, no-store, must-revalidate";
    headers["pragma"] = "no-cache";
  }
  res.writeHead(200, headers);
  fs.createReadStream(p).pipe(res);
  return true;
}

export function handleIndex(req, res) {
  const landingPath = path.join(PROJECT_ROOT, "index.html");
  const uiPath = path.join(PROJECT_ROOT, "ui", "index.html");
  const p = fs.existsSync(landingPath) ? landingPath : uiPath;
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end("index.html not found"); }
  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-cache, no-store, must-revalidate",
  });
  return fs.createReadStream(p).pipe(res);
}

export function handleStaticFile(req, res, pathname) {
  let safePath;
  try { safePath = decodeURIComponent(pathname); } catch { return false; }
  if (safePath.includes("..") || safePath.includes("~") || safePath.includes("\0")) return false;
  const filePath = path.resolve(PROJECT_ROOT, safePath.replace(/^\/+/, ""));
  const root = path.resolve(PROJECT_ROOT);
  if (!filePath.startsWith(root + path.sep) && filePath !== root) return false;
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return false;
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] || "application/octet-stream";
  const headers = { "content-type": mime };
  if (ext === ".js" || ext === ".css" || ext === ".html") {
    headers["cache-control"] = "no-cache, no-store, must-revalidate";
    headers["pragma"] = "no-cache";
  }
  res.writeHead(200, headers);
  fs.createReadStream(filePath).pipe(res);
  return true;
}
