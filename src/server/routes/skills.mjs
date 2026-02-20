/**
 * Routes: /api/skills/*, /api/skillcards/*, /skillcards/*
 */

import fs from "node:fs";
import os from "node:os";
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

function yamlSafe(v) {
  const s = String(v || "");
  if (!s) return "\"\"";
  if (/[:{}\[\]#&*!|>'"%@`,\n]/.test(s) || s.startsWith(" ") || s.endsWith(" ")) {
    return `"${s.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
  }
  return s;
}

function resolveHumanizerSlug(allSlugs) {
  const preferred = ["clawhub-humanizer", "clawhub-humanizer-2", "clawhub-afrexai-humanizer"];
  for (const s of preferred) {
    if (allSlugs.has(s)) return s;
  }
  return "";
}

function collectAutoInstallSlugs(skillcard, normalizedSlug, allSlugs) {
  const out = new Set();
  const requested = Array.isArray(skillcard?.autoInstallSkills) ? skillcard.autoInstallSkills : [];
  for (const r of requested) {
    const slug = toSlug(r);
    if (!slug) continue;
    if (slug === "humanizer") {
      const resolved = resolveHumanizerSlug(allSlugs);
      if (resolved) out.add(resolved);
      continue;
    }
    if (allSlugs.has(slug)) out.add(slug);
  }
  // Product requirement: Lincoln AI always auto-installs a humanizer companion.
  if (normalizedSlug === "lincoln-ai") {
    const resolved = resolveHumanizerSlug(allSlugs);
    if (resolved) out.add(resolved);
  }
  out.delete(normalizedSlug);
  return [...out];
}

function readCardFromIndexMatch(store, match) {
  if (!match?.fileName) return null;
  const fp = store.resolveSkillFilePath(match.source, match.fileName);
  if (!fp) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(fp, "utf8"));
    return parsed?.card && typeof parsed.card === "object" ? parsed.card : parsed;
  } catch {
    return null;
  }
}

function upsertUserSkill(store, auth, skillcard, sourceUrl, createdAt) {
  const name = String(skillcard.name || "").trim();
  if (!name) throw new Error("skillcard.name required");
  const slug = toSlug(skillcard.slug || name);
  if (!slug) throw new Error("skillcard.slug required");
  const version = safeVersion(skillcard.version || "1.0.0");
  if (!version) throw new Error("skillcard.version invalid (expected semver-ish)");
  const desc = String(skillcard.description || "").trim();
  const riskTierRaw = Number(skillcard?.constraints?.riskTier ?? skillcard?.riskTier ?? 2);
  const riskTier = Number.isFinite(riskTierRaw) ? Math.max(1, Math.min(3, Math.round(riskTierRaw))) : 2;
  const fileName = `${slug}.v${version}.json`;

  store.writeUserSkillFile(fileName, { ...skillcard, slug, version, name, description: desc });

  const idx = store.getUserSkillsIndex();
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
    onchainTokenId: skillcard?.onchainTokenId ?? null,
    onchainMintTx: skillcard?.onchainMintTx ?? null,
    onchainPublishTx: skillcard?.onchainPublishTx ?? null,
  };
  const next = skills.filter((s) => String(s?.fileName || "") !== fileName);
  next.unshift(entry);
  store.writeUserSkillsIndex({ skills: next });
  return entry;
}

function installOpenClawSkillCard(skillcard, fallbackSlug = "") {
  const slugValue = toSlug(skillcard?.slug || fallbackSlug || skillcard?.name || "");
  if (!slugValue) throw new Error("invalid slug for OpenClaw install");
  const skillDir = path.join(os.homedir(), ".openclaw", "skills", slugValue);
  fs.mkdirSync(skillDir, { recursive: true });
  const doc = String(skillcard?.documentation_md || "").trim();
  const name = String(skillcard?.name || slugValue).trim();
  const version = String(skillcard?.version || "1.0.0").trim();
  const description = String(skillcard?.description || "").trim();
  if (Buffer.byteLength(doc, "utf8") > 300_000) throw new Error("documentation_md too large");
  const frontmatter = `---\nname: ${slugValue}\nversion: ${yamlSafe(version)}\ndescription: ${yamlSafe(description.slice(0, 300))}\n---\n`;
  let content;
  if (doc) {
    const stripped = doc.replace(/^---[\s\S]*?---\s*/, "").trim();
    content = `${frontmatter}\n${stripped}\n`;
  } else {
    content = `${frontmatter}\n# ${name}\n\n${description}\n`;
  }
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), content, "utf8");
  return { slug: slugValue, skillDir };
}

function uninstallOpenClawSkillBySlug(slug) {
  const s = toSlug(slug || "");
  if (!s) return { removed: null, missing: null };
  const skillDir = path.join(os.homedir(), ".openclaw", "skills", s);
  const skillMd = path.join(skillDir, "SKILL.md");
  if (!fs.existsSync(skillMd)) {
    return { removed: null, missing: { slug: s, reason: "SKILL.md not found" } };
  }
  fs.unlinkSync(skillMd);
  try {
    const leftover = fs.readdirSync(skillDir);
    if (leftover.length === 0) fs.rmdirSync(skillDir);
  } catch {}
  return { removed: { slug: s, skillDir }, missing: null };
}

export function handleSkillsSearch(req, res, reqUrl) {
  try {
    const store = getStorage();
    const query = String(reqUrl.searchParams.get("q") || "").trim().toLowerCase();
    const sourceFilter = String(reqUrl.searchParams.get("source") || "").trim().toLowerCase();
    const vettedFilter = String(reqUrl.searchParams.get("vetted") || "").trim();
    const page = Math.max(1, Number(reqUrl.searchParams.get("page") || 1));
    const limit = Math.min(15000, Math.max(1, Number(reqUrl.searchParams.get("limit") || 50)));
    let results = store.getMergedSkillIndex();
    if (sourceFilter && ["seed", "bundled", "imported", "user"].includes(sourceFilter)) results = results.filter((s) => s.source === sourceFilter);
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
    const paginatedResults = results.slice(start, start + limit);
    const slim = reqUrl.searchParams.get("slim") === "1";
    const payload = slim
      ? paginatedResults.map((s) => ({
          name: s.name, slug: s.slug, description: s.description,
          riskTier: s.riskTier, source: s.source, vettedOk: s.vettedOk,
          fileName: s.fileName || null,
          onchainTokenId: s.onchainTokenId || null,
          onchainMintTx: s.onchainMintTx || null,
          onchainPublishTx: s.onchainPublishTx || null,
        }))
      : paginatedResults;
    res.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=120, s-maxage=300, stale-while-revalidate=600",
    });
    return res.end(JSON.stringify({ ok: true, total, page, limit, pages, results: payload }));
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
    const bundled = all.filter((s) => s.source === "bundled").length;
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
    return res.end(JSON.stringify({ ok: true, total: all.length, seed, bundled, imported, user, vetted, onchain, recent }));
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
    const createdAt = new Date().toISOString();
    const store = getStorage();
    const sourceUrl = String(body?.sourceUrl || skillcard?.provenance?.sourceUrl || "").trim();
    const entry = upsertUserSkill(store, auth, { ...skillcard, slug, name }, sourceUrl, createdAt);

    const merged = store.getMergedSkillIndex();
    const allSlugs = new Set(merged.map((s) => String(s?.slug || "")));
    const autoInstallSlugs = collectAutoInstallSlugs(skillcard, slug, allSlugs);
    const autoInstalled = [];
    const autoInstallMissing = [];
    const openclawInstalled = [];
    const openclawInstallMissing = [];

    for (const depSlug of autoInstallSlugs) {
      try {
        const depMatch = merged.find((s) => s.slug === depSlug);
        if (!depMatch) {
          autoInstallMissing.push({ slug: depSlug, reason: "not found in merged index" });
          continue;
        }
        const depCard = readCardFromIndexMatch(store, depMatch);
        if (!depCard || typeof depCard !== "object") {
          autoInstallMissing.push({ slug: depSlug, reason: "skill card file unreadable" });
          continue;
        }
        const depSourceUrl = String(depMatch.sourceUrl || depCard?.provenance?.sourceUrl || "").trim();
        const depEntry = upsertUserSkill(store, auth, depCard, depSourceUrl, createdAt);
        autoInstalled.push({
          slug: depEntry.slug,
          name: depEntry.name,
          version: depEntry.version,
          fileName: depEntry.fileName,
        });
      } catch (depErr) {
        autoInstallMissing.push({ slug: depSlug, reason: depErr?.message || "unknown dependency install error" });
      }
    }

    try {
      const oc = installOpenClawSkillCard(skillcard, slug);
      openclawInstalled.push({ slug: oc.slug, skillDir: oc.skillDir });
    } catch (ocErr) {
      openclawInstallMissing.push({ slug, reason: ocErr?.message || "openclaw install failed" });
    }
    for (const depSlug of autoInstallSlugs) {
      try {
        const depMatch = merged.find((s) => s.slug === depSlug);
        if (!depMatch) continue;
        const depCard = readCardFromIndexMatch(store, depMatch);
        if (!depCard) continue;
        const oc = installOpenClawSkillCard(depCard, depSlug);
        openclawInstalled.push({ slug: oc.slug, skillDir: oc.skillDir });
      } catch (ocErr) {
        openclawInstallMissing.push({ slug: depSlug, reason: ocErr?.message || "openclaw dependency install failed" });
      }
    }

    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({
      ok: true,
      entry,
      fileHref: `/skillcards/user/${encodeURIComponent(entry.fileName)}`,
      autoInstalled,
      autoInstallMissing,
      openclawInstalled,
      openclawInstallMissing,
    }));
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
    const removed = skills.find((s) => String(s?.fileName || "") === fileName) || null;
    store.writeUserSkillsIndex({ skills: skills.filter((s) => String(s?.fileName || "") !== fileName) });
    const openclawRemoved = [];
    const openclawRemoveMissing = [];
    const { removed: ocRemoved, missing: ocMissing } = uninstallOpenClawSkillBySlug(removed?.slug || "");
    if (ocRemoved) openclawRemoved.push(ocRemoved);
    if (ocMissing) openclawRemoveMissing.push(ocMissing);
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: true, openclawRemoved, openclawRemoveMissing }));
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
    bundled: path.join(PROJECT_ROOT, "data", "skills"),
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
