/**
 * Routes: /api/skills/*, /api/skillcards/*, /skillcards/*
 */

import fs from "node:fs";
import path from "node:path";
import { ROOT as PROJECT_ROOT } from "../../lib/paths.mjs";
import { getStorage } from "../storage/index.mjs";
import { requireSkillWriteAuth } from "../middleware/auth.mjs";
import { collectBody } from "../middleware/body-limit.mjs";

function toSlug(input) {
  return String(input || "").toLowerCase().trim()
    .replace(/®/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function safeVersion(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  if (!/^[0-9]+(\.[0-9]+){0,3}([\-+][0-9A-Za-z._-]+)?$/.test(s)) return "";
  return s;
}

export function handleSkillsSearch(req, res, reqUrl) {
  try {
    const store = getStorage();
    const query = String(reqUrl.searchParams.get("q") || "").trim().toLowerCase();
    const sourceFilter = String(reqUrl.searchParams.get("source") || "").trim().toLowerCase();
    const vettedFilter = String(reqUrl.searchParams.get("vetted") || "").trim();
    const page = Math.max(1, Number(reqUrl.searchParams.get("page") || 1));
    const limit = Math.min(5000, Math.max(1, Number(reqUrl.searchParams.get("limit") || 50)));
    let results = store.getMergedSkillIndex();
    if (sourceFilter && ["seed", "imported", "user"].includes(sourceFilter)) results = results.filter((s) => s.source === sourceFilter);
    if (vettedFilter === "1") results = results.filter((s) => s.vettedOk === true);
    if (query) {
      results = results.filter((s) => {
        const n = String(s.name || "").toLowerCase();
        const sl = String(s.slug || "").toLowerCase();
        const d = String(s.description || "").toLowerCase();
        return n.includes(query) || sl.includes(query) || d.includes(query);
      });
    }
    const total = results.length;
    const pages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: true, total, page, limit, pages, results: results.slice(start, start + limit) }));
  } catch (err) {
    res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: false, error: err.message || "search failed" }));
  }
}

export function handleSkillsGet(req, res, reqUrl) {
  try {
    const store = getStorage();
    const slug = String(reqUrl.searchParams.get("slug") || "").trim();
    if (!slug) { res.writeHead(400, { "content-type": "application/json; charset=utf-8" }); return res.end(JSON.stringify({ ok: false, error: "missing slug" })); }
    const all = store.getMergedSkillIndex();
    const match = all.find((s) => s.slug === slug);
    if (!match) { res.writeHead(404, { "content-type": "application/json; charset=utf-8" }); return res.end(JSON.stringify({ ok: false, error: "skill not found" })); }
    let fullCard = null;
    if (match.fileName) {
      const fp = store.resolveSkillFilePath(match.source, match.fileName);
      if (fp) try { fullCard = JSON.parse(fs.readFileSync(fp, "utf8")); } catch {}
    }
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: true, skill: match, card: fullCard }));
  } catch (err) {
    res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: false, error: err.message || "get failed" }));
  }
}

export function handleSkillsStats(req, res) {
  try {
    const store = getStorage();
    const all = store.getMergedSkillIndex();
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
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: true, total: all.length, seed, imported, user, vetted, onchain, recent }));
  } catch (err) {
    res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: false, error: err.message || "stats failed" }));
  }
}

export function handleSkillcardsUserGet(req, res) {
  try {
    const store = getStorage();
    const raw = store.getUserSkillsIndex();
    const skills = Array.isArray(raw?.skills) ? raw.skills : [];
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: true, skills }));
  } catch (err) {
    res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: false, error: err.message || "failed to load index" }));
  }
}

export function handleSkillcardsAuthCheck(req, res) {
  const auth = requireSkillWriteAuth(req);
  res.writeHead(auth.ok ? 200 : 401, { "content-type": "application/json; charset=utf-8" });
  return res.end(JSON.stringify({ ok: auth.ok, mode: auth.mode, agentId: auth.agentId }));
}

export async function handleSkillcardsUserAdd(req, res) {
  const auth = requireSkillWriteAuth(req);
  if (!auth.ok) {
    res.writeHead(401, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: false, error: "unauthorized (set x-agent-id/x-agent-token or x-registration-key)" }));
  }
  const raw = await collectBody(req, res);
  if (raw === null) return;
  try {
    const body = JSON.parse(raw);
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
    const fileName = `${slug}.v${version}.json`;
    const store = getStorage();
    store.writeUserSkillFile(fileName, { ...skillcard, slug, version, name, description: desc });
    const idx = store.getUserSkillsIndex();
    const skills = Array.isArray(idx?.skills) ? idx.skills : [];
    const entry = { fileName, name, slug, version, description: desc, riskTier, sourceUrl, createdAt, addedBy: auth.mode, addedByAgentId: auth.agentId };
    const next = skills.filter((s) => String(s?.fileName || "") !== fileName);
    next.unshift(entry);
    store.writeUserSkillsIndex({ skills: next });
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: true, entry, fileHref: `/skillcards/user/${encodeURIComponent(fileName)}` }));
  } catch (err) {
    res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: false, error: err.message || "invalid request" }));
  }
}

export async function handleSkillcardsUserDelete(req, res) {
  const auth = requireSkillWriteAuth(req);
  if (!auth.ok) {
    res.writeHead(401, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: false, error: "unauthorized" }));
  }
  const raw = await collectBody(req, res);
  if (raw === null) return;
  try {
    const body = JSON.parse(raw);
    const fileName = String(body?.fileName || "").trim();
    if (!fileName || fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) throw new Error("invalid fileName");
    const store = getStorage();
    store.deleteUserSkillFile(fileName);
    const idx = store.getUserSkillsIndex();
    const skills = Array.isArray(idx?.skills) ? idx.skills : [];
    store.writeUserSkillsIndex({ skills: skills.filter((s) => String(s?.fileName || "") !== fileName) });
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: false, error: err.message || "invalid request" }));
  }
}

export async function handleSkillcardsUserMarkOnchain(req, res) {
  const auth = requireSkillWriteAuth(req);
  if (!auth.ok) {
    res.writeHead(401, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: false, error: "unauthorized" }));
  }
  const raw = await collectBody(req, res);
  if (raw === null) return;
  try {
    const body = JSON.parse(raw);
    const fileName = String(body?.fileName || "").trim();
    if (!fileName || fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) throw new Error("invalid fileName");
    const skillIdNum = Number(body?.skillId);
    if (!Number.isFinite(skillIdNum) || skillIdNum <= 0) throw new Error("invalid skillId");
    const txHash = String(body?.txHash || "").trim();
    const store = getStorage();
    const idx = store.getUserSkillsIndex();
    const skills = Array.isArray(idx?.skills) ? idx.skills : [];
    let found = false;
    const next = skills.map((s) => {
      if (String(s?.fileName || "") !== fileName) return s;
      found = true;
      return { ...s, onchain: { skillId: Math.floor(skillIdNum), txHash, markedAt: new Date().toISOString() } };
    });
    if (!found) throw new Error("skill not found");
    store.writeUserSkillsIndex({ skills: next });
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: false, error: err.message || "invalid request" }));
  }
}

export function handleSkillcardFile(req, res, pathname) {
  const store = getStorage();
  const segments = pathname.slice("/skillcards/".length).split("/");
  const bucket = segments[0];
  const fileName = segments.length > 1 ? decodeURIComponent(segments.slice(1).join("/")) : "";
  const ALLOWED_BUCKETS = {
    user: store.SKILLCARDS_USER_DIR,
    imported: path.join(PROJECT_ROOT, "skillcards", "imported"),
    seed: store.SKILLCARDS_SEED_DIR,
  };
  const baseDir = ALLOWED_BUCKETS[bucket];
  if (!baseDir || !fileName || fileName.includes("..") || fileName.includes("\\")) {
    res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ error: "invalid file" }));
  }
  const filePath = path.join(baseDir, fileName);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ error: "not found" }));
  }
  res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  return fs.createReadStream(filePath).pipe(res);
}
