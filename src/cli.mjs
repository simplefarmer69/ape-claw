#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson, randomId } from "./lib/io.mjs";
import {
  ROOT,
  STATE_DIR,
  QUOTES_PATH,
  BRIDGE_REQUESTS_PATH,
  POLICY_PATH,
  ALLOWLIST_PATH,
  OPENSEA_OVERRIDES_PATH,
} from "./lib/paths.mjs";
import {
  loadPolicy,
  loadAllowlist,
  normalizeAllowlist,
  resolveCollectionTarget,
  enforceBuyPolicy,
  enforceBridgePolicy,
} from "./lib/policy.mjs";
import { emitEvent } from "./lib/telemetry.mjs";
import { getListings, enrichAllowlistWithOpenSea } from "./lib/market.mjs";
import { quoteBridgeRelay, executeBridgeRelay, getBridgeRelayStatus } from "./lib/bridge-relay.mjs";
import { getListingFulfillmentData, executeListingFulfillmentTx } from "./lib/nft-opensea.mjs";
import { resolveRpcUrl } from "./lib/rpc.mjs";
import { verifyClawbot, registerClawbot, listClawbots, loadClawbotsConfig } from "./lib/clawbots.mjs";
import { createInterface } from "node:readline";
import { createPublicClient, createWalletClient, http, getContract, keccak256, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SkillNFT_ABI, SkillRegistry_ABI, IntentRegistry_ABI, ReceiptRegistry_ABI, PodVault_ABI, AgentAccount_ABI } from "./lib/v2-onchain-abi.mjs";
import { computeSkillcardContentHash, computeSkillVersionHash, readSkillcardJson, stableJsonStringify } from "./lib/v2-skillcard.mjs";
import { initPodWorkspace } from "./lib/pod-init.mjs";

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) out[key] = true;
      else {
        out[key] = next;
        i++;
      }
    } else out._.push(a);
  }
  return out;
}

function print(data, asJson) {
  if (asJson) console.log(JSON.stringify(data, null, 2));
  else if (typeof data === "string") console.log(data);
  else console.log(JSON.stringify(data, null, 2));
}

// Global agentId ref — set after identity resolution, used by fail()
let _agentId = "local-cli";
let _asJson = false;

function fail(message, command, payload = {}) {
  emitEvent({
    eventType: "policy.blocked",
    agentId: _agentId,
    command,
    payload,
    ok: false,
    error: message,
  });
  if (_asJson) {
    console.log(JSON.stringify({ ok: false, error: message, command }, null, 2));
  } else {
    console.error(message);
  }
  process.exit(1);
}

function loadState(filePath) {
  const obj = readJson(filePath, {});
  return obj && typeof obj === "object" ? obj : {};
}

function isoDay(value = new Date()) {
  return new Date(value).toISOString().slice(0, 10);
}

function expectedBuyConfirmPhrase(quote) {
  return `BUY ${quote.collection} #${quote.tokenId} ${quote.priceApe} APE`;
}

function expectedBridgeConfirmPhrase(req) {
  return `BRIDGE ${req.amount} ${req.token} ${req.from}->${req.to}`;
}

function authStorePath() {
  return path.join(os.homedir(), ".ape-claw", "auth.json");
}

function loadAuthStore() {
  const p = authStorePath();
  const data = readJson(p, {});
  return data && typeof data === "object" ? data : {};
}

function writeAuthStore(data) {
  const p = authStorePath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), { mode: 0o600 });
}

function maskSecret(value) {
  const v = String(value || "");
  if (!v) return "";
  if (v.length <= 8) return "*".repeat(v.length);
  return `${v.slice(0, 4)}...${v.slice(-4)}`;
}

function spentTodayFromQuotes(quotes, dayKey) {
  return Object.values(quotes).reduce((sum, q) => {
    if (!q || !q.executedAt || !q.executed) return sum;
    if (isoDay(q.executedAt) !== dayKey) return sum;
    return sum + (Number(q.priceApe) || 0);
  }, 0);
}

function spentTodayFromBridge(requests, dayKey) {
  return Object.values(requests).reduce((sum, r) => {
    if (!r || !r.submittedAt) return sum;
    if (r.status === "quoted") return sum;
    if (isoDay(r.submittedAt) !== dayKey) return sum;
    return sum + (Number(r.amount) || 0);
  }, 0);
}

function installApeClawSkill(args) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const packageRoot = path.resolve(here, "..");
  const sourceSkillPath = path.join(packageRoot, ".cursor", "skills", "ape-claw", "SKILL.md");
  if (!fs.existsSync(sourceSkillPath)) {
    throw new Error(`Source skill missing at ${sourceSkillPath}`);
  }

  const scope = String(args.scope || "local").toLowerCase();
  const explicitSkillsDir = args["skills-dir"] ? String(args["skills-dir"]) : "";
  let skillsRoot;
  if (explicitSkillsDir) {
    skillsRoot = path.resolve(explicitSkillsDir);
    if (skillsRoot.includes("\0")) throw new Error("Invalid skills-dir path");
  }
  else if (scope === "global") skillsRoot = path.join(os.homedir(), ".openclaw", "skills");
  else skillsRoot = path.join(process.cwd(), ".cursor", "skills");

  const targetSkillDir = path.join(skillsRoot, "ape-claw");
  const targetSkillPath = path.join(targetSkillDir, "SKILL.md");
  fs.mkdirSync(targetSkillDir, { recursive: true });
  fs.copyFileSync(sourceSkillPath, targetSkillPath);

  const localPolicyPath = path.join(process.cwd(), "config", "policy.json");
  const examplePolicyPath = path.join(packageRoot, "config", "policy.example.json");
  if (!fs.existsSync(localPolicyPath) && fs.existsSync(examplePolicyPath)) {
    fs.mkdirSync(path.dirname(localPolicyPath), { recursive: true });
    fs.copyFileSync(examplePolicyPath, localPolicyPath);
  }

  const localAllowlistPath = path.join(process.cwd(), "allowlists", "recommended.apechain.json");
  const sourceAllowlistPath = path.join(packageRoot, "allowlists", "recommended.apechain.json");
  if (!fs.existsSync(localAllowlistPath) && fs.existsSync(sourceAllowlistPath)) {
    fs.mkdirSync(path.dirname(localAllowlistPath), { recursive: true });
    fs.copyFileSync(sourceAllowlistPath, localAllowlistPath);
  }

  const localClawbotsPath = path.join(process.cwd(), "config", "clawbots.json");
  const exampleClawbotsPath = path.join(packageRoot, "config", "clawbots.example.json");
  if (!fs.existsSync(localClawbotsPath) && fs.existsSync(exampleClawbotsPath)) {
    fs.copyFileSync(exampleClawbotsPath, localClawbotsPath);
  }

  const check = spawnSync("openclaw", ["skills", "check"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  const openclawAvailable = !check.error && typeof check.status === "number";
  const openclawCheckOk = openclawAvailable && check.status === 0;

  return {
    installed: true,
    scope,
    sourceSkillPath,
    skillsRoot,
    packageRoot,
    skillPath: targetSkillPath,
    starterPack: { installed: 0, skipped: false, categories: {}, skills: [] },
    openclawAvailable,
    openclawCheckOk,
    openclawCheckOutput: openclawAvailable
      ? (check.stdout || check.stderr || "").trim()
      : "openclaw CLI not found in PATH",
    next: openclawAvailable
      ? [
          "openclaw skills list",
          "openclaw skills check",
        ]
      : [
          "Install OpenClaw CLI or add it to PATH",
          "Run: openclaw skills list",
        ],
  };
}

function yamlSafe(val) {
  const s = String(val);
  if (!s) return '""';
  if (/[:{}\[\]#&*!|>'"%@`,\n]/.test(s) || s.startsWith(" ") || s.endsWith(" ")) {
    return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return s;
}

function syncSkillToOpenClaw(cardObj, slug, skillsRoot) {
  const s = String(slug || cardObj?.slug || cardObj?.name || "").toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!s) return null;
  const rawDoc = String(cardObj?.documentation_md || "").trim();
  const displayName = String(cardObj?.name || s).trim();
  const versionValue = String(cardObj?.version || "1.0.0").trim();
  const descriptionValue = String(cardObj?.description || "").trim();
  const descOneLine = descriptionValue.replace(/\n/g, " ").slice(0, 300);

  const openclawFrontmatter = `---\nname: ${s}\nversion: ${yamlSafe(versionValue)}\ndescription: ${yamlSafe(descOneLine)}\n---\n`;

  let content;
  if (rawDoc) {
    // Strip existing frontmatter from documentation_md and prepend OpenClaw-compatible one
    const stripped = rawDoc.replace(/^---[\s\S]*?---\s*/, "").trim();
    content = openclawFrontmatter + "\n" + stripped;
  } else {
    content = openclawFrontmatter + `\n# ${displayName}\n\n${descriptionValue}\n`;
  }

  const skillDir = path.join(skillsRoot, s);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), content, "utf8");

  const openclawWorkspaceSkills = path.join(os.homedir(), ".openclaw", "workspace", "skills", s);
  try {
    fs.mkdirSync(openclawWorkspaceSkills, { recursive: true });
    fs.writeFileSync(path.join(openclawWorkspaceSkills, "SKILL.md"), content, "utf8");
  } catch {}

  return { slug: s, skillDir };
}

function installStarterPack({ packageRoot, skillsRoot }) {
  const starterPackInstalled = [];
  const openclawSynced = [];
  const openclawSyncFailed = [];
  const bundlePath = path.join(packageRoot, "data", "starter-pack-bundle.json");
  const legacyPackPath = path.join(packageRoot, "data", "starter-pack.json");

  const starterDir = path.join(skillsRoot, "starter-pack");
  fs.mkdirSync(starterDir, { recursive: true });
  const manifestEntries = [];
  let curatedSkills = [];
  if (fs.existsSync(legacyPackPath)) {
    try {
      const curatedPack = JSON.parse(fs.readFileSync(legacyPackPath, "utf8"));
      curatedSkills = Array.isArray(curatedPack?.skills) ? curatedPack.skills : [];
    } catch {}
  }

  function processEntry(entry, cardObj) {
    const slug = String(entry.slug || "").trim();
    manifestEntries.push({
      slug,
      name: entry.name,
      category: entry.category,
      description: entry.description,
      vettedOk: entry.vettedOk,
      onchain: entry.onchain,
      installedAt: new Date().toISOString(),
    });
    starterPackInstalled.push({
      slug,
      name: entry.name,
      category: entry.category,
      description: entry.description,
    });
    try {
      const result = syncSkillToOpenClaw(cardObj, slug, skillsRoot);
      if (result) openclawSynced.push(result);
    } catch (err) {
      openclawSyncFailed.push({ slug, reason: err?.message || "sync failed" });
    }
  }

  if (fs.existsSync(bundlePath)) {
    const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));
    const bundleSkills = Array.isArray(bundle?.skills) ? bundle.skills : [];
    const bundleBySlug = new Map();
    for (const item of bundleSkills) {
      const s = String(item?.slug || "").trim();
      if (s) bundleBySlug.set(s, item);
    }
    const installFromBundle = curatedSkills.length
      ? curatedSkills.map((c) => bundleBySlug.get(String(c?.slug || "").trim())).filter(Boolean)
      : bundleSkills;
    for (const entry of installFromBundle) {
      const slug = String(entry.slug || "").trim();
      if (!slug || !entry.fullJson) continue;
      const targetJson = path.join(starterDir, `${slug}.json`);
      fs.writeFileSync(targetJson, JSON.stringify(entry.fullJson));
      const card = entry.fullJson?.card && typeof entry.fullJson.card === "object"
        ? entry.fullJson.card : entry.fullJson;
      processEntry(entry, card);
    }
  } else if (fs.existsSync(legacyPackPath)) {
    const pack = JSON.parse(fs.readFileSync(legacyPackPath, "utf8"));
    const skillsDataDir = path.join(packageRoot, "data", "skills");
    for (const entry of (pack.skills || [])) {
      const slug = String(entry.slug || "").trim();
      if (!slug) continue;
      const sourceJson = path.join(skillsDataDir, `${slug}.json`);
      if (!fs.existsSync(sourceJson)) continue;
      const targetJson = path.join(starterDir, `${slug}.json`);
      fs.copyFileSync(sourceJson, targetJson);
      let card = {};
      try { const raw = JSON.parse(fs.readFileSync(sourceJson, "utf8")); card = raw?.card || raw; } catch {}
      processEntry(entry, card);
    }
  }

  if (manifestEntries.length > 0) {
    const manifest = {
      version: 1,
      installedAt: new Date().toISOString(),
      count: manifestEntries.length,
      skills: manifestEntries,
    };
    fs.writeFileSync(
      path.join(starterDir, "_manifest.json"),
      JSON.stringify(manifest, null, 2),
    );
  }

  const categorySummary = {};
  for (const s of starterPackInstalled) {
    categorySummary[s.category] = (categorySummary[s.category] || 0) + 1;
  }

  return {
    installed: starterPackInstalled.length,
    skipped: false,
    categories: categorySummary,
    skills: starterPackInstalled,
    openclawSynced: openclawSynced.length,
    openclawSyncFailed,
  };
}

function toSlug(input) {
  return String(input || "").toLowerCase().trim()
    .replace(/®/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function safeSkillVersion(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  if (!/^[0-9]+(\.[0-9]+){0,3}([\-+][0-9A-Za-z._-]+)?$/.test(s)) return "";
  return s;
}

const TRUSTED_SKILL_API_HOSTS = new Set(["apeclaw.ai", "www.apeclaw.ai", "api.apeclaw.ai"]);

function resolveSkillApiBase(args = {}) {
  const explicit = String(args.api || "").trim();
  const fromEnv = String(process.env.APE_CLAW_API_URL || "").trim();
  const raw = explicit || fromEnv || "https://apeclaw.ai";
  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new Error(`Invalid APE_CLAW_API_URL: ${raw}`);
  }
  const isLoopback = u.hostname === "localhost" || u.hostname === "127.0.0.1";
  if (u.protocol !== "https:" && !(isLoopback && Boolean(args["allow-insecure-api"]))) {
    throw new Error("Remote skill API must use HTTPS. For local dev only, use --allow-insecure-api with localhost.");
  }
  if (!TRUSTED_SKILL_API_HOSTS.has(u.hostname) && !Boolean(args["allow-custom-api"])) {
    throw new Error(`Untrusted skill API host: ${u.hostname}. Use --allow-custom-api to override.`);
  }
  return u.origin.replace(/\/+$/, "");
}

function assertRemoteSkillCardSafe({ requestedSlug, card, skillMeta = null, asJson = false, allowUnvetted = false, allowHighRisk = false }) {
  if (!card || typeof card !== "object") throw new Error("Remote API returned invalid skill card object");
  const normalizedRequested = toSlug(requestedSlug);
  const normalizedCardSlug = toSlug(card.slug || card.name || "");
  if (!normalizedCardSlug) throw new Error("Remote skill card missing slug/name");
  if (normalizedCardSlug !== normalizedRequested) {
    throw new Error(`Remote skill slug mismatch (requested=${normalizedRequested}, received=${normalizedCardSlug})`);
  }
  const version = safeSkillVersion(card.version || "1.0.0");
  if (!version) throw new Error("Remote skill version is invalid");
  const description = String(card.description || "").trim();
  if (!description) throw new Error("Remote skill description is required");
  const documentation = String(card.documentation_md || "");
  if (Buffer.byteLength(documentation, "utf8") > 300_000) {
    throw new Error("Remote skill documentation is too large (>300KB)");
  }
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(documentation)) {
    throw new Error("Remote skill documentation contains control characters");
  }

  const metaRiskTierRaw = Number(skillMeta?.riskTier ?? card?.constraints?.riskTier ?? card?.riskTier ?? 2);
  const metaRiskTier = Number.isFinite(metaRiskTierRaw) ? Math.max(1, Math.min(3, Math.round(metaRiskTierRaw))) : 2;
  if (metaRiskTier >= 3 && !allowHighRisk) {
    throw new Error(`Remote skill risk tier ${metaRiskTier} requires explicit --allow-high-risk`);
  }
  // If API metadata is present, require vetting by default.
  if (skillMeta && skillMeta.vettedOk !== true && !allowUnvetted) {
    throw new Error("Remote skill is not vetted. Use --allow-unvetted to install anyway.");
  }

  if (!asJson && skillMeta && skillMeta.vettedOk === true) {
    console.log("\x1b[2m  Security: vetted skill metadata confirmed by API.\x1b[0m");
  }
}

function resolveBundledSkillFile(packageRoot, slug) {
  const skillsDataDir = path.join(packageRoot, "data", "skills");
  const target = path.join(skillsDataDir, `${slug}.json`);
  if (fs.existsSync(target)) return target;

  // Check starter-pack-bundle.json for the skill
  for (const bp of ["data/starter-pack-bundle.json", "data/starter-pack.json"]) {
    const bundlePath = path.join(packageRoot, bp);
    if (!fs.existsSync(bundlePath)) continue;
    try {
      const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));
      const skills = Array.isArray(bundle.skills) ? bundle.skills : Array.isArray(bundle) ? bundle : [];
      const match = skills.find((s) => toSlug(s?.slug || s?.name || "") === slug);
      if (match) {
        const tmpPath = path.join(skillsDataDir, `_resolved_${slug}.json`);
        fs.mkdirSync(skillsDataDir, { recursive: true });
        fs.writeFileSync(tmpPath, JSON.stringify(match, null, 2), "utf8");
        return tmpPath;
      }
    } catch {}
  }
  return "";
}

async function fetchSkillFromApi(slug, args = {}) {
  const apiBase = resolveSkillApiBase(args);
  const url = `${apiBase}/api/skills/${encodeURIComponent(slug)}`;
  try {
    const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return { card: null, skillMeta: null, url, apiBase };
    const json = await res.json();
    const card = json?.card || json?.skill || json || null;
    const skillMeta = json?.skill && typeof json.skill === "object" ? json.skill : null;
    return { card, skillMeta, url, apiBase };
  } catch {
    return { card: null, skillMeta: null, url, apiBase };
  }
}

function resolveHumanizerDependencySlug(packageRoot) {
  const preferred = ["clawhub-humanizer", "clawhub-humanizer-2", "clawhub-afrexai-humanizer"];
  for (const slug of preferred) {
    if (resolveBundledSkillFile(packageRoot, slug)) return slug;
  }
  return "";
}

function installOpenClawSkillCard(cardObj, fallbackSlug = "") {
  const skillsRoot = path.join(ROOT, ".cursor", "skills");
  return syncSkillToOpenClaw(cardObj, fallbackSlug, skillsRoot);
}

function installBundledSkillBySlug({ packageRoot, slug, authMode = "cli", authAgentId = "local-cli" }) {
  const normalizedSlug = toSlug(slug);
  if (!normalizedSlug) throw new Error("invalid skill slug");

  const skillsDataDir = path.join(packageRoot, "data", "skills");
  if (!fs.existsSync(skillsDataDir)) {
    throw new Error(`Bundled skills directory not found: ${skillsDataDir}`);
  }

  const userDir = path.join(STATE_DIR, "skillcards-user");
  const userIndexPath = path.join(userDir, "index.json");
  writeJson(userIndexPath, readJson(userIndexPath, { skills: [] }) || { skills: [] });

  const installed = [];
  const autoInstalled = [];
  const autoInstallMissing = [];
  const openclawInstalled = [];
  const openclawInstallMissing = [];
  const seen = new Set();

  function upsertOne(targetSlug, isDependency = false) {
    const s = toSlug(targetSlug);
    if (!s || seen.has(s)) return null;
    seen.add(s);

    const filePath = resolveBundledSkillFile(packageRoot, s);
    if (!filePath) {
      if (isDependency) {
        autoInstallMissing.push({ slug: s, reason: "bundled skill file not found" });
        return null;
      }
      throw new Error(`Skill not found in bundled library: ${s}`);
    }

    const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const card = raw?.card && typeof raw.card === "object" ? raw.card : raw;
    if (!card || typeof card !== "object") throw new Error(`Malformed skill card: ${s}`);

    const name = String(card.name || "").trim();
    if (!name) throw new Error(`skillcard.name required for ${s}`);
    const cardSlug = toSlug(card.slug || name);
    if (!cardSlug) throw new Error(`skillcard.slug required for ${s}`);
    const version = safeSkillVersion(card.version || "1.0.0");
    if (!version) throw new Error(`skillcard.version invalid for ${s}`);
    const description = String(card.description || "").trim();
    const riskTierRaw = Number(card?.constraints?.riskTier ?? card?.riskTier ?? 2);
    const riskTier = Number.isFinite(riskTierRaw) ? Math.max(1, Math.min(3, Math.round(riskTierRaw))) : 2;
    const createdAt = new Date().toISOString();
    const sourceUrl = String(card?.provenance?.sourceUrl || "").trim();
    const fileName = `${cardSlug}.v${version}.json`;

    const payload = { ...card, slug: cardSlug, version, name, description };
    writeJson(path.join(userDir, fileName), payload);

    const idx = readJson(userIndexPath, { skills: [] }) || { skills: [] };
    const skills = Array.isArray(idx.skills) ? idx.skills : [];
    const entry = {
      fileName,
      name,
      slug: cardSlug,
      version,
      description,
      riskTier,
      sourceUrl,
      createdAt,
      addedBy: authMode,
      addedByAgentId: authAgentId,
    };
    const next = skills.filter((it) => String(it?.fileName || "") !== fileName);
    next.unshift(entry);
    writeJson(userIndexPath, { skills: next });

    if (isDependency) autoInstalled.push(entry);
    else installed.push(entry);

    try {
      const oc = installOpenClawSkillCard(card, cardSlug);
      openclawInstalled.push({ slug: oc.slug, skillDir: oc.skillDir });
    } catch (ocErr) {
      openclawInstallMissing.push({ slug: cardSlug, reason: ocErr?.message || "openclaw install failed" });
    }

    const deps = Array.isArray(card.autoInstallSkills) ? card.autoInstallSkills.map((x) => toSlug(x)).filter(Boolean) : [];
    if (cardSlug === "lincoln-ai") deps.push("humanizer");
    for (const dep of deps) {
      let depSlug = dep;
      if (dep === "humanizer") depSlug = resolveHumanizerDependencySlug(packageRoot);
      if (!depSlug) {
        autoInstallMissing.push({ slug: dep, reason: "dependency resolver could not find matching bundled skill" });
        continue;
      }
      if (depSlug === cardSlug) continue;
      upsertOne(depSlug, true);
    }

    return entry;
  }

  upsertOne(normalizedSlug, false);
  return {
    ok: true,
    mode: "bundled-skill-install",
    root: ROOT,
    stateDir: STATE_DIR,
    userSkillDir: userDir,
    installed,
    autoInstalled,
    autoInstallMissing,
    openclawInstalled,
    openclawInstallMissing,
  };
}

function promptUser(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

function resolveRemoteApiBase(args = {}) {
  const explicit = String(args.api || "").trim();
  const fromEnv = String(process.env.APE_CLAW_API_BASE || process.env.APE_CLAW_TELEMETRY_URL || "").trim();
  const base = explicit || fromEnv;
  return base ? base.replace(/\/+$/, "") : "";
}

async function registerClawbotRemote({ apiBase, agentId, displayName, registrationKey, invite }) {
  const headers = { "content-type": "application/json" };
  if (registrationKey) headers["x-registration-key"] = registrationKey;
  const res = await fetch(`${apiBase}/api/clawbots/register`, {
    method: "POST",
    headers,
    body: JSON.stringify({ agentId, name: displayName, ...(invite ? { invite } : {}) }),
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch {}
  if (!res.ok) {
    const msg = data?.error || `HTTP ${res.status}`;
    throw new Error(`remote registration failed: ${msg}`);
  }
  return data;
}

async function verifyClawbotRemote({ apiBase, agentId, agentToken }) {
  const res = await fetch(`${apiBase}/api/clawbots/verify`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-agent-id": agentId,
      "x-agent-token": agentToken,
    },
    body: JSON.stringify({ agentId }),
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch {}
  if (!res.ok) {
    const msg = data?.reason || data?.error || `HTTP ${res.status}`;
    throw new Error(`remote verify failed: ${msg}`);
  }
  return data;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [group, sub] = args._;
  const asJson = Boolean(args.json);
  _asJson = asJson;
  const command = `ape-claw ${args._.join(" ")}`.trim();

  // Allow skill installation in any directory without local ape-claw config.
  if (group === "skill" && sub === "install") {
    const requestedSkillSlug = String(args._[2] || "").trim();
    if (requestedSkillSlug) {
      const here = path.dirname(fileURLToPath(import.meta.url));
      const packageRoot = path.resolve(here, "..");
      let result;
      try {
        result = installBundledSkillBySlug({
          packageRoot,
          slug: requestedSkillSlug,
          authMode: "cli",
          authAgentId: _agentId,
        });
      } catch (bundledErr) {
        // Not in bundled data — fetch from API
        if (!asJson) console.log(`\x1b[2m  Skill not bundled locally, fetching from API…\x1b[0m`);
        let remote;
        try {
          remote = await fetchSkillFromApi(requestedSkillSlug, args);
        } catch (apiErr) {
          if (asJson) return print({ ok: false, error: `Skill "${requestedSkillSlug}" rejected: ${apiErr.message}` }, true);
          console.error(`\x1b[31m  ✗ ${apiErr.message}\x1b[0m`);
          process.exitCode = 1;
          return;
        }
        const card = remote?.card || null;
        if (!card || typeof card !== "object" || (!card.name && !card.slug)) {
          if (asJson) return print({ ok: false, error: `Skill "${requestedSkillSlug}" not found (bundled: ${bundledErr.message}, API: not found)` }, true);
          console.error(`\x1b[31m  ✗ Skill "${requestedSkillSlug}" not found in bundled library or API.\x1b[0m`);
          console.error(`\x1b[2m    Browse available skills at https://apeclaw.ai/skills\x1b[0m`);
          process.exitCode = 1;
          return;
        }
        try {
          assertRemoteSkillCardSafe({
            requestedSlug: requestedSkillSlug,
            card,
            skillMeta: remote?.skillMeta || null,
            asJson,
            allowUnvetted: Boolean(args["allow-unvetted"]),
            allowHighRisk: Boolean(args["allow-high-risk"]),
          });
        } catch (safeErr) {
          if (asJson) return print({ ok: false, error: safeErr.message }, true);
          console.error(`\x1b[31m  ✗ ${safeErr.message}\x1b[0m`);
          console.error(`\x1b[2m    Use --allow-unvetted and/or --allow-high-risk only if you trust this source.\x1b[0m`);
          process.exitCode = 1;
          return;
        }
        // Write fetched card to a temp file and install it
        const tmpDir = path.join(packageRoot, "data", "skills");
        fs.mkdirSync(tmpDir, { recursive: true });
        const resolvedSlug = toSlug(requestedSkillSlug);
        const tmpFile = path.join(tmpDir, `${resolvedSlug}.json`);
        fs.writeFileSync(tmpFile, JSON.stringify(card, null, 2), "utf8");
        result = installBundledSkillBySlug({
          packageRoot,
          slug: requestedSkillSlug,
          authMode: "cli",
          authAgentId: _agentId,
        });
      }
      emitEvent({ eventType: "skill.install.slug.ran", command, dryRun: true, result });
      if (asJson) return print(result, true);

      console.log();
      console.log(`\x1b[1m\x1b[33m  ✅  SKILL INSTALLED\x1b[0m`);
      if (result.installed[0]) {
        const s = result.installed[0];
        console.log(`  \x1b[36mPrimary:\x1b[0m ${s.name} (${s.slug} v${s.version})`);
      }
      if (result.autoInstalled.length) {
        console.log(`  \x1b[36mAuto-installed:\x1b[0m`);
        for (const s of result.autoInstalled) console.log(`    - ${s.name} (${s.slug} v${s.version})`);
      }
      if (result.autoInstallMissing.length) {
        console.log(`  \x1b[33mDependency warnings:\x1b[0m`);
        for (const m of result.autoInstallMissing) console.log(`    - ${m.slug}: ${m.reason}`);
      }
      if (result.openclawInstalled.length) {
        console.log(`  \x1b[36mOpenClaw synced:\x1b[0m ${result.openclawInstalled.length}`);
      }
      if (result.openclawInstallMissing.length) {
        console.log(`  \x1b[33mOpenClaw sync warnings:\x1b[0m`);
        for (const m of result.openclawInstallMissing) console.log(`    - ${m.slug}: ${m.reason}`);
      }
      console.log(`  \x1b[36mState dir:\x1b[0m ${result.stateDir}`);
      console.log(`  \x1b[36mUser skill index:\x1b[0m ${path.join(result.userSkillDir, "index.json")}`);
      console.log();
      return;
    }

    const result = installApeClawSkill(args);
    emitEvent({ eventType: "skill.install.ran", command, dryRun: true, result });

    // ── Starter Pack: 61 curated, globally-applicable skills (opt-in) ──
    const skipStarterPack = Boolean(args["no-starter-pack"]);
    const forceStarterPack = Boolean(args["starter-pack"]);
    const bundlePath = path.join(result.packageRoot, "data", "starter-pack-bundle.json");
    const legacyPackPath = path.join(result.packageRoot, "data", "starter-pack.json");
    const starterPackAvailable = fs.existsSync(bundlePath) || fs.existsSync(legacyPackPath);

    let installPack = false;
    if (skipStarterPack || !starterPackAvailable) {
      installPack = false;
    } else if (forceStarterPack) {
      installPack = true;
    } else if (asJson) {
      installPack = false;
    } else {
      console.log();
      console.log(`\x1b[1m\x1b[33m  📦  STARTER PACK AVAILABLE\x1b[0m`);
      console.log(`\x1b[2m  61 curated, security-vetted skills across productivity, dev tools,\x1b[0m`);
      console.log(`\x1b[2m  security, analytics, SEO, automation, and memory.\x1b[0m`);
      console.log();
      const answer = await promptUser("  Install the starter pack? [Y/n] ");
      installPack = answer === "" || answer === "y" || answer === "yes";
    }

    if (installPack) {
      try {
        result.starterPack = installStarterPack({
          packageRoot: result.packageRoot,
          skillsRoot: result.skillsRoot,
        });
      } catch {
        // Non-fatal: starter pack failure shouldn't block core install
      }
    } else if (!skipStarterPack && starterPackAvailable && !asJson) {
      console.log(`\x1b[2m  Skipped. Install later with: ape-claw skill install --starter-pack\x1b[0m`);
      result.starterPack.skipped = true;
    } else {
      result.starterPack.skipped = true;
    }

    if (asJson) return print(result, true);

    const W = 64;
    const line = "─".repeat(W);
    const dline = "═".repeat(W);
    const thinLine = "╌".repeat(W);
    console.log();
    console.log(`\x1b[1m\x1b[33m${dline}\x1b[0m`);
    console.log(`\x1b[1m\x1b[33m  🦞  APE CLAW — INSTALLATION COMPLETE\x1b[0m`);
    console.log(`\x1b[1m\x1b[33m${dline}\x1b[0m`);
    console.log();
    console.log(`  \x1b[36mScope:\x1b[0m         ${result.scope}`);
    console.log(`  \x1b[36mSkills dir:\x1b[0m    ${result.skillsRoot}`);
    console.log(`  \x1b[36mCore skill:\x1b[0m    ${result.skillPath}`);

    const sp = result.starterPack;
    if (sp && sp.installed > 0) {
      console.log();
      console.log(`\x1b[1m  📦  STARTER PACK — ${sp.installed} skills installed\x1b[0m`);
      console.log(`  ${line}`);

      const catOrder = Object.entries(sp.categories)
        .sort((a, b) => b[1] - a[1]);
      for (const [cat, count] of catOrder) {
        console.log(`  \x1b[33m${cat}\x1b[0m (${count})`);
        const inCat = sp.skills
          .filter((s) => s.category === cat)
          .sort((a, b) => a.name.localeCompare(b.name));
        for (const s of inCat) {
          const nameStr = s.name.length > 38 ? s.name.slice(0, 35) + "..." : s.name;
          const desc = (s.description || "").length > 50 ? s.description.slice(0, 47) + "..." : (s.description || "");
          console.log(`    \x1b[32m✓\x1b[0m ${nameStr.padEnd(39)} \x1b[2m${desc}\x1b[0m`);
        }
      }
      console.log(`  ${line}`);
      console.log(`  \x1b[1m\x1b[32m${sp.installed} skills ready\x1b[0m across \x1b[33m${catOrder.length} categories\x1b[0m`);
      if (sp.openclawSynced > 0) {
        console.log(`  \x1b[36mOpenClaw synced:\x1b[0m ${sp.openclawSynced} skill folders written to ${result.skillsRoot}`);
      }
      if (sp.openclawSyncFailed && sp.openclawSyncFailed.length > 0) {
        console.log(`  \x1b[33mOpenClaw sync warnings:\x1b[0m ${sp.openclawSyncFailed.length} failed`);
        for (const f of sp.openclawSyncFailed.slice(0, 5)) {
          console.log(`    - ${f.slug}: ${f.reason}`);
        }
      }

      const featured = [
        { name: "Gog", desc: "Gmail, Calendar, Drive, Sheets, Docs via CLI" },
        { name: "GitHub", desc: "Issues, PRs, CI runs via gh CLI" },
        { name: "Self-Improving Agent", desc: "Learns from mistakes, gets smarter over time" },
        { name: "Find Skills", desc: "Discovers & installs new skills on demand" },
        { name: "Humanizer", desc: "Removes AI writing patterns from text" },
      ];
      const hasFeatured = sp.skills.some((s) =>
        s.slug === "clawhub-gog" || s.slug === "clawhub-github" ||
        s.slug === "clawhub-self-improving-agent" || s.slug === "clawhub-find-skills" ||
        s.slug === "clawhub-humanizer"
      );
      if (hasFeatured) {
        console.log();
        console.log(`\x1b[1m  ⭐  FEATURED SKILLS\x1b[0m`);
        console.log(`  ${thinLine}`);
        for (const f of featured) {
          console.log(`    \x1b[33m${f.name.padEnd(28)}\x1b[0m ${f.desc}`);
        }
      }
    }

    console.log();
    console.log(`\x1b[1m  🤖  YOUR CLAWBOT CAN NOW:\x1b[0m`);
    console.log(`  ${thinLine}`);
    console.log(`    • Bridge tokens to ApeChain & buy NFTs on ApeChain marketplaces`);
    console.log(`    • Execute DeFi trades (SushiSwap, Uniswap, lending protocols)`);
    console.log(`    • Monitor wallets, contracts, and on-chain events in real-time`);
    console.log(`    • Analyze blockchain data, token metrics, and portfolio performance`);
    console.log(`    • Manage Google Workspace (Gmail, Calendar, Drive, Sheets, Docs)`);
    console.log(`    • Interact with GitHub (issues, PRs, CI, code review)`);
    console.log(`    • Discover & install 10,000+ skills from the ApeClaw library`);
    console.log(`    • Self-improve by logging errors and learning from corrections`);
    console.log(`    • Humanize AI-generated text to sound natural`);
    console.log(`    • Communicate P2P with other agents via encrypted channels`);

    console.log();
    const runner = `npx ape-claw`;
    console.log(`\x1b[1m  📋  NEXT STEPS:\x1b[0m`);
    console.log(`  ${thinLine}`);
    console.log(`    \x1b[36m1.\x1b[0m Install a skill by name:`);
    console.log(`       \x1b[32m${runner} skill install <slug>\x1b[0m`);
    console.log(`    \x1b[36m2.\x1b[0m Browse all 10,000+ skills:`);
    console.log(`       \x1b[4mhttps://apeclaw.ai/skills\x1b[0m`);
    console.log(`    \x1b[36m3.\x1b[0m Register your clawbot (optional — enables telemetry + dashboard):`);
    console.log(`       \x1b[32m${runner} clawbot register --agent-id my-bot --name "My ClawBot" --json\x1b[0m`);
    console.log(`    \x1b[36m4.\x1b[0m Verify your setup:`);
    console.log(`       \x1b[32m${runner} doctor --json\x1b[0m`);
    console.log(`    \x1b[36m5.\x1b[0m Optional — for onchain execute/bridge commands:`);
    console.log(`       \x1b[2mexport APE_CLAW_RPC_URL=https://rpc.apechain.com/http\x1b[0m`);
    console.log(`       \x1b[2mexport APE_CLAW_WALLET_KEY=0x...\x1b[0m`);

    console.log();
    console.log(`  \x1b[2mDocs:\x1b[0m  https://apeclaw.ai/docs`);
    console.log(`  \x1b[2mDash:\x1b[0m  https://apeclaw.ai/dashboard`);
    console.log(`  \x1b[2mHelp:\x1b[0m  ${runner} --help`);
    console.log();
    console.log(`\x1b[1m\x1b[33m${dline}\x1b[0m`);
    console.log();
    return;
  }

  // ── Clawbot commands (before policy load so they work in any directory)
  if (group === "clawbot" && sub === "register") {
    const agentId = String(args["agent-id"] || "").trim();
    const displayName = String(args.name || agentId || "").trim();
    if (!agentId) fail("--agent-id is required", command, args);
    const apiBase = resolveRemoteApiBase(args);
    const registrationKey = String(args["registration-key"] || process.env.APE_CLAW_REGISTRATION_KEY || "").trim();
    const invite = String(args.invite || process.env.APE_CLAW_INVITE || "").trim();
    try {
      if (apiBase) {
        const reg = await registerClawbotRemote({ apiBase, agentId, displayName, registrationKey, invite });
        const result = {
          ...reg,
          remote: true,
          apiBase,
        };
        emitEvent({ eventType: "clawbot.registered", command, dryRun: true, result: { agentId: reg.agentId, name: reg.name || displayName, remote: true } });
        return print(result, asJson);
      }
      const reg = registerClawbot({ agentId, displayName });
      const result = {
        registered: true,
        agentId: reg.agentId,
        name: reg.displayName,
        token: reg.token,
        note: "Save this token — it is shown only once. Use as APE_CLAW_AGENT_TOKEN or --agent-token.",
        remote: false,
      };
      emitEvent({ eventType: "clawbot.registered", command, dryRun: true, result: { agentId: reg.agentId, name: reg.displayName } });
      return print(result, asJson);
    } catch (err) {
      fail(err.message, command, { agentId, apiBase: apiBase || null });
    }
  }
  if (group === "clawbot" && sub === "list") {
    const bots = listClawbots();
    const result = { count: bots.length, clawbots: bots };
    emitEvent({ eventType: "clawbot.list.read", command, dryRun: true, result: { count: bots.length } });
    return print(result, asJson);
  }

  // ── Local auth profile commands (stored in ~/.ape-claw/auth.json)
  if (group === "auth" && sub === "set") {
    const current = loadAuthStore();
    const next = { ...current };
    let changed = 0;

    const setIfProvided = (flag, key) => {
      if (args[flag] !== undefined) {
        const val = String(args[flag] || "").trim();
        if (val) next[key] = val;
        else delete next[key];
        changed++;
      }
    };

    setIfProvided("agent-id", "agentId");
    setIfProvided("agent-token", "agentToken");
    setIfProvided("opensea-api-key", "openseaApiKey");
    setIfProvided("private-key", "privateKey");

    if (changed === 0) {
      fail("Provide at least one of --agent-id --agent-token --opensea-api-key --private-key", command, args);
    }

    writeAuthStore(next);
    const result = {
      ok: true,
      saved: true,
      path: authStorePath(),
      fields: {
        agentId: next.agentId || null,
        agentToken: Boolean(next.agentToken),
        openseaApiKey: Boolean(next.openseaApiKey),
        privateKey: Boolean(next.privateKey),
      },
      note: "Secrets are stored locally in ~/.ape-claw/auth.json (mode 600). Env vars and flags still override these values.",
    };
    emitEvent({ eventType: "auth.saved", command, dryRun: true, result: { path: authStorePath() } });
    return print(result, asJson);
  }

  if (group === "auth" && sub === "show") {
    const cur = loadAuthStore();
    const result = {
      ok: true,
      path: authStorePath(),
      auth: {
        agentId: cur.agentId || null,
        agentToken: cur.agentToken ? maskSecret(cur.agentToken) : null,
        openseaApiKey: cur.openseaApiKey ? maskSecret(cur.openseaApiKey) : null,
        privateKey: cur.privateKey ? maskSecret(cur.privateKey) : null,
      },
    };
    return print(result, asJson);
  }

  if (group === "auth" && sub === "clear") {
    const cur = loadAuthStore();
    const field = String(args.field || "").trim();
    if (Boolean(args.all)) {
      writeAuthStore({});
      return print({ ok: true, cleared: "all", path: authStorePath() }, asJson);
    }
    const allowed = new Set(["agent-id", "agent-token", "opensea-api-key", "private-key"]);
    if (!allowed.has(field)) {
      fail('Use --field one of: "agent-id" | "agent-token" | "opensea-api-key" | "private-key", or --all', command, args);
    }
    const keyMap = {
      "agent-id": "agentId",
      "agent-token": "agentToken",
      "opensea-api-key": "openseaApiKey",
      "private-key": "privateKey",
    };
    delete cur[keyMap[field]];
    writeAuthStore(cur);
    return print({ ok: true, cleared: field, path: authStorePath() }, asJson);
  }

  // ── Resolve agent identity
  const storedAuth = loadAuthStore();
  const agentId = String(args["agent-id"] || process.env.APE_CLAW_AGENT_ID || storedAuth.agentId || "local-cli").trim();
  _agentId = agentId;
  const agentToken = String(args["agent-token"] || process.env.APE_CLAW_AGENT_TOKEN || storedAuth.agentToken || "").trim();
  const apiBaseForIdentity = resolveRemoteApiBase(args);
  let verifiedBot = null;
  let sharedOpenseaKey = "";
  if (agentToken) {
    const v = verifyClawbot({ agentId, agentToken });
    if (v.verified) {
      verifiedBot = v.agent;
      sharedOpenseaKey = v.sharedOpenseaApiKey || "";
    } else {
      // If this machine doesn't have clawbots.json (or it's out of date),
      // try to verify against the shared backend when configured.
      if (apiBaseForIdentity) {
        try {
          const rv = await verifyClawbotRemote({ apiBase: apiBaseForIdentity, agentId, agentToken });
          if (rv?.verified) {
            verifiedBot = rv.agent || { id: agentId, name: agentId };
            sharedOpenseaKey = String(rv.sharedOpenseaApiKey || "");
          } else {
            fail(`Clawbot verification failed: ${v.reason}`, command, { agentId });
          }
        } catch (err) {
          fail(`Clawbot verification failed: ${v.reason}`, command, { agentId, remote: apiBaseForIdentity, remoteError: err.message });
        }
      } else {
        fail(`Clawbot verification failed: ${v.reason}. Register first with: ape-claw clawbot register --agent-id <id> --json`, command, { agentId });
      }
    }
  }

  // Override emitEvent defaults with agentId
  const emit = (opts) => emitEvent({ ...opts, agentId });

  const policy = loadPolicy();
  let allowlist = normalizeAllowlist(loadAllowlist());
  // Use shared key for verified bots, else fall back to env
  const openseaKey = process.env.OPENSEA_API_KEY || sharedOpenseaKey || storedAuth.openseaApiKey || "";
  const relayApiKey = process.env.RELAY_API_KEY || "";
  const privateKeyFromEnv = String(process.env.APE_CLAW_PRIVATE_KEY || "").trim();
  const privateKeyFromProfile = String(storedAuth.privateKey || "").trim();
  const privateKey = privateKeyFromEnv || privateKeyFromProfile || "";
  const privateKeySource = privateKeyFromEnv ? "env" : (privateKeyFromProfile ? "local-auth" : "missing");
  const slugOverrides = readJson(OPENSEA_OVERRIDES_PATH, {}) || {};

  if (group === "doctor") {
    const unresolvedCount = allowlist.filter((c) => !c.contractAddress).length;
    const openseaRequired = String(policy.market.dataSource || "").toLowerCase() === "opensea";
    const clawbotsConfig = loadClawbotsConfig() || {};
    const registeredAgent = Boolean(clawbotsConfig?.agents?.[agentId]);
    const sharedKeyConfigured = Boolean(clawbotsConfig?.sharedOpenseaApiKey || process.env.APE_CLAW_SHARED_OPENSEA_KEY);
    const sharedKeyInjected = Boolean(sharedOpenseaKey);
    const openseaProvided = Boolean(openseaKey);
    const openseaMissing = openseaRequired && !openseaProvided;
    const privateKeyMissing = !privateKey;
    const issues = [];
    const warnings = [];
    if (openseaMissing) {
      warnings.push("OpenSea API key is not available for this agent. Set OPENSEA_API_KEY, or verify a clawbot so sharedOpenseaApiKey can be injected.");
    }
    if (registeredAgent && sharedKeyConfigured && !sharedKeyInjected) {
      warnings.push("This agent is registered and shared OpenSea key is configured, but not injected yet. Provide --agent-token (or save once via: ape-claw auth set --agent-id <id> --agent-token <token> --json).");
    }
    if (privateKeyMissing) {
      warnings.push("Private key not detected for execute flows. Read-only commands are ready. For execution, provide APE_CLAW_PRIVATE_KEY, save with ape-claw auth set --private-key, or map your OpenClaw bot secret to APE_CLAW_PRIVATE_KEY.");
    }
    const executeReady = !openseaMissing && !privateKeyMissing;
    const readOnlyReady = issues.length === 0;
    const nextSteps = [];
    if (registeredAgent && !verifiedBot) {
      nextSteps.push("Verify this registered clawbot to inject shared OpenSea key: ape-claw doctor --agent-id <id> --agent-token <token> --json");
      nextSteps.push("Or persist once: ape-claw auth set --agent-id <id> --agent-token <token> --json");
    }
    if (openseaMissing && !registeredAgent) {
      nextSteps.push("Standalone mode: set OPENSEA_API_KEY (env) or save with ape-claw auth set --opensea-api-key <key> --json");
    }
    if (privateKeyMissing) {
      nextSteps.push("For execute flows, set APE_CLAW_PRIVATE_KEY (env), or save with ape-claw auth set --private-key 0x... --json");
      nextSteps.push("If your OpenClaw bot already has a wallet secret, map/export it as APE_CLAW_PRIVATE_KEY before running execute commands.");
    }
    if (!privateKeyMissing && !openseaMissing) {
      nextSteps.push("Execute-ready: you can run buy/bridge commands with --execute.");
    } else {
      nextSteps.push("Read-only ready: use market/quote/simulate flows now, then complete missing execute prerequisites.");
    }
    const result = {
      ok: issues.length === 0,
      issues,
      warnings,
      chainId: policy.apechainChainId,
      rpcConfigured: Boolean(policy.apechainRpcUrl),
      agent: {
        agentId,
        verified: Boolean(verifiedBot),
        name: verifiedBot?.name || agentId,
        sharedKeyAvailable: sharedKeyInjected,
        sharedKeyInjected,
        localAuthProfile: Boolean(storedAuth.agentId || storedAuth.agentToken || storedAuth.openseaApiKey || storedAuth.privateKey),
        registered: registeredAgent,
      },
      bridge: {
        provider: policy.bridge.provider,
        relayApiKeyRequired: false,
        relayApiKeyProvided: Boolean(process.env.RELAY_API_KEY),
        executeRequiresPrivateKey: true,
      },
      market: {
        dataSource: policy.market.dataSource,
        openseaApiKeyRequired: openseaRequired,
        openseaApiKeyProvided: openseaProvided,
      },
      execution: {
        privateKeyProvided: !privateKeyMissing,
        privateKeySource,
        readOnlyReady,
        executeReady,
        dailySpendCap: policy.execution.dailySpendCap,
        confirmPhraseRequired: policy.execution.confirmPhraseRequired,
        simulationRequired: policy.nftBuy.simulationRequired,
        maxPricePerTx: policy.nftBuy.maxPricePerTx,
      },
      policyPath: POLICY_PATH,
      allowlistPath: ALLOWLIST_PATH,
      allowlistStats: { total: allowlist.length, unresolvedCount },
      recommendations: ["Use --json for agent parsing", "Use --execute for state-changing calls"],
      nextSteps,
    };
    emit({ eventType: "doctor.ran", command, dryRun: true, result });
    return print(result, asJson);
  }

  if (group === "quickstart") {
    const unresolvedCount = allowlist.filter((c) => !c.contractAddress).length;
    const openseaRequired = String(policy.market.dataSource || "").toLowerCase() === "opensea";
    const clawbotsConfig = loadClawbotsConfig() || {};
    const registeredAgent = Boolean(clawbotsConfig?.agents?.[agentId]);
    const sharedKeyInjected = Boolean(sharedOpenseaKey);
    const openseaProvided = Boolean(openseaKey);
    const openseaMissing = openseaRequired && !openseaProvided;
    const privateKeyMissing = !privateKey;
    const executeReady = !openseaMissing && !privateKeyMissing;
    const readOnlyReady = true;

    const runner = "npx ape-claw";
    const suggested = [
      `${runner} doctor --json`,
      `${runner} clawbot register --agent-id my-bot --name "My Bot" --json`,
      `${runner} auth set --agent-id my-bot --agent-token claw_... --json`,
      `${runner} market collections --recommended --json`,
    ];
    if (privateKeyMissing) {
      suggested.push(`${runner} auth set --private-key 0x... --json`);
    }

    const summary = [];
    summary.push(readOnlyReady ? "Read-only flows are ready." : "Read-only flows need configuration.");
    summary.push(
      executeReady
        ? "Execute flows are ready."
        : "Execute flows need missing secrets (private key and/or OpenSea API key).",
    );
    if (registeredAgent && !sharedKeyInjected) {
      summary.push("Registered bot detected: provide agent token to inject shared OpenSea key.");
    }
    if (openseaMissing && !registeredAgent) {
      summary.push("Standalone mode: set OPENSEA_API_KEY or save one with auth set.");
    }

    const nextSteps = [];
    if (!registeredAgent) {
      nextSteps.push('Register a bot first: ape-claw clawbot register --agent-id my-bot --name "My Bot" --json');
    } else if (!sharedKeyInjected) {
      nextSteps.push("Save your bot token once: ape-claw auth set --agent-id <id> --agent-token <token> --json");
    }
    if (privateKeyMissing) {
      nextSteps.push("Set private key for execute flows: ape-claw auth set --private-key 0x... --json");
    }
    if (!openseaMissing && !privateKeyMissing) {
      nextSteps.push("Run execute flows now: ape-claw nft buy --quote <quoteId> --execute --autonomous --json");
    } else {
      nextSteps.push("Use read-only flows now: ape-claw market collections --recommended --json");
    }

    const result = {
      ok: true,
      message: "Personalized onboarding steps for this machine.",
      status: {
        agentId,
        registered: registeredAgent,
        verified: Boolean(verifiedBot),
        sharedKeyInjected,
        readOnlyReady,
        executeReady,
        privateKeyProvided: !privateKeyMissing,
        openseaApiKeyProvided: openseaProvided,
        allowlistUnresolvedCount: unresolvedCount,
      },
      summary,
      recommendedCommands: suggested,
      nextSteps,
      note: "Use npx commands if global ape-claw is not on PATH yet.",
    };
    emit({ eventType: "quickstart.ran", command, dryRun: true, result });
    return print(result, asJson);
  }

  if (group === "chain" && sub === "info") {
    const chainId = Number(policy.apechainChainId || 33139);
    let latestBlock = null;
    try {
      const rpcUrl = await resolveRpcUrl(chainId, policy);
      const rpcRes = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
      });
      const rpcJson = await rpcRes.json();
      if (rpcJson.result) latestBlock = parseInt(rpcJson.result, 16);
    } catch {
      // RPC unavailable — leave null so bots know it's unknown
    }
    const result = {
      chainId,
      nativeGasToken: policy.nativeGasToken,
      bridgeProvider: policy.bridge.provider,
      marketDataSource: policy.market.dataSource,
      latestBlock,
      rpcOk: latestBlock !== null,
    };
    emit({ eventType: "chain.info.read", command, dryRun: true, result });
    return print(result, asJson);
  }

  if (group === "market" && sub === "collections") {
    const recommendedOnly = Boolean(args.recommended);
    if (String(policy.market.dataSource).toLowerCase() === "opensea" && openseaKey) {
      const enriched = await enrichAllowlistWithOpenSea(allowlist, openseaKey, slugOverrides);
      allowlist = enriched.allowlist;
    }
    const data = recommendedOnly ? allowlist.filter((c) => c.enabled !== false) : allowlist;
    // Strip rank from agent-facing output — rank is metadata only, never a decision signal
    const collections = data.map(({ rank, ...rest }) => rest);
    const result = { count: collections.length, collections, source: policy.market.dataSource };
    emit({
      eventType: "market.collections.read",
      command,
      dryRun: true,
      result: { count: data.length, source: policy.market.dataSource },
    });
    return print(result, asJson);
  }

  if (group === "market" && sub === "listings") {
    const collection = args.collection;
    if (!collection) fail("--collection is required", command, args);
    const maxPrice = Number(args.maxPrice || policy.nftBuy.maxPricePerTx);
    let result;
    try {
      const out = await getListings({
        collection,
        tokenId: args.tokenId,
        maxPrice,
        dataSource: args.dataSource || policy.market.dataSource,
        apiKey: openseaKey,
        slugOverrides,
      });
      const listings = out.listings || [];
      result = { count: listings.length, listings, source: out.source, notes: out.notes || [] };
    } catch (err) {
      result = { count: 0, listings: [], source: policy.market.dataSource, error: err.message };
      emit({
        eventType: "market.listings.failed",
        command,
        dryRun: true,
        payload: args,
        result,
        ok: false,
        error: err.message,
      });
      return print(result, asJson);
    }
    emit({ eventType: "market.listings.read", command, dryRun: true, payload: args, result });
    return print(result, asJson);
  }

  if (group === "nft" && sub === "autobuy") {
    const execute = Boolean(args.execute);
    const autonomous = Boolean(args.autonomous);
    const count = Math.max(1, Number(args.count || 1));
    const scanLimit = Math.max(count, Number(args.scan || Math.max(10, count * 4)));
    const maxPrice = Number(args.maxPrice || policy.nftBuy.maxPricePerTx);
    const minPrice = Number(args.minPrice || 0);
    const budget = Number(args.budget || 0);
    const currency = String(args.currency || "APE").toUpperCase();
    const dataSource = String(args.dataSource || policy.market.dataSource || "opensea");
    const includeDisabled = Boolean(args.all);
    const collectionsArg = String(args.collections || "").trim();
    const collectionFilters = collectionsArg
      ? collectionsArg
          .split(",")
          .map((x) => x.trim().toLowerCase())
          .filter(Boolean)
      : [];

    if (!Number.isFinite(maxPrice) || maxPrice <= 0) fail("--maxPrice must be > 0", command, args);
    if (!Number.isFinite(minPrice) || minPrice < 0) fail("--minPrice must be >= 0", command, args);
    if (minPrice > maxPrice) fail("--minPrice must be <= --maxPrice", command, args);
    if (currency !== "APE") fail("nft autobuy currently supports --currency APE only", command, args);
    if (String(dataSource).toLowerCase() === "opensea" && !openseaKey) {
      fail("OPENSEA_API_KEY is required for nft autobuy with OpenSea data source.", command, args);
    }
    if (execute && !privateKey) {
      fail(
        "APE_CLAW_PRIVATE_KEY is required for live nft autobuy execute. Set env var, save once with `ape-claw auth set --private-key 0x... --json`, or map your OpenClaw bot wallet secret to APE_CLAW_PRIVATE_KEY.",
        command,
        args,
      );
    }

    let universe = includeDisabled ? [...allowlist] : allowlist.filter((c) => c.enabled !== false);
    if (collectionFilters.length > 0) {
      universe = universe.filter((c) => {
        const hay = `${String(c.name || "").toLowerCase()} ${String(c.slug || "").toLowerCase()}`;
        return collectionFilters.some((needle) => hay.includes(needle));
      });
    }
    universe = universe.slice(0, scanLimit);
    if (universe.length === 0) fail("No collections matched autobuy selection.", command, args);

    const candidates = [];
    const skipped = [];
    for (const c of universe) {
      const collectionRef = c.slug || c.name;
      if (!collectionRef) {
        skipped.push({ collection: c.name || "unknown", reason: "missing collection reference" });
        continue;
      }
      try {
        const policyCheck = enforceBuyPolicy({
          policy,
          collection: collectionRef,
          maxPrice,
          currency,
          allowUnsafe: Boolean(args["allow-unsafe"]),
          allowlist,
        });
        if (!policyCheck.ok) {
          skipped.push({ collection: collectionRef, reason: policyCheck.errors.join(" ") });
          continue;
        }
        const listingsOut = await getListings({
          collection: c.slug || collectionRef,
          maxPrice,
          dataSource,
          apiKey: openseaKey,
          slugOverrides,
        });
        const live = (listingsOut.listings || [])
          .filter((l) => {
            const p = Number(l.priceApe);
            return Number.isFinite(p) && p > 0 && p >= minPrice && p <= maxPrice;
          })
          .sort((a, b) => Number(a.priceApe) - Number(b.priceApe))[0];
        if (!live) {
          skipped.push({ collection: collectionRef, reason: "no listing within price range" });
          continue;
        }
        candidates.push({
          collection: collectionRef,
          collectionName: c.name || collectionRef,
          listing: live,
          priceApe: Number(live.priceApe),
          target: policyCheck.target || resolveCollectionTarget(collectionRef, allowlist).exact,
        });
      } catch (err) {
        skipped.push({ collection: collectionRef, reason: err.message });
      }
    }

    const sorted = candidates.sort((a, b) => a.priceApe - b.priceApe);
    const selected = [];
    let remaining = Number.isFinite(budget) && budget > 0 ? budget : Number.POSITIVE_INFINITY;
    for (const c of sorted) {
      if (selected.length >= count) break;
      if (c.priceApe > remaining) continue;
      selected.push(c);
      remaining -= c.priceApe;
    }
    if (selected.length === 0) {
      const result = {
        ok: true,
        message: "No autobuy candidates selected under current constraints.",
        constraints: { count, scanLimit, minPrice, maxPrice, budget: budget > 0 ? budget : null, currency, dataSource, includeDisabled },
        scannedCollections: universe.length,
        candidateCount: candidates.length,
        selectedCount: 0,
        skipped,
      };
      emit({ eventType: "nft.autobuy.planned", command, dryRun: !execute, payload: args, result });
      return print(result, asJson);
    }

    const quotes = loadState(QUOTES_PATH);
    const planned = [];
    for (const s of selected) {
      const quoteId = randomId("q");
      const quote = {
        quoteId,
        collection: s.collection,
        collectionTarget: s.target?.contractAddress || s.target?.slug || s.collection,
        tokenId: String(s.listing.tokenId),
        currency,
        priceApe: s.priceApe,
        maxPrice,
        expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
        listingId: s.listing.listingId,
        orderHash: s.listing.orderHash || randomId("order"),
        routeHash: s.listing.source || "opensea",
        source: s.listing.source || "opensea",
        protocolAddress: s.listing.protocolAddress || "0x0000000000000068f116a894984e2db1123eb395",
        assetContractAddress: s.listing.assetContractAddress || s.target?.contractAddress || null,
        chainId: Number(policy.apechainChainId || 33139),
        dryRunDefault: true,
      };
      quotes[quoteId] = quote;
      planned.push({ quoteId, collection: quote.collection, tokenId: quote.tokenId, priceApe: quote.priceApe });
    }
    writeJson(QUOTES_PATH, quotes);

    if (!execute) {
      const result = {
        ok: true,
        dryRun: true,
        message: "Autobuy planned quotes generated. Re-run with --execute --autonomous to send.",
        constraints: { count, scanLimit, minPrice, maxPrice, budget: budget > 0 ? budget : null, currency, dataSource, includeDisabled },
        scannedCollections: universe.length,
        candidateCount: candidates.length,
        selectedCount: selected.length,
        planned,
        skipped,
      };
      emit({ eventType: "nft.autobuy.planned", command, dryRun: true, payload: args, result });
      return print(result, asJson);
    }

    if (!autonomous) {
      fail("nft autobuy execute requires --autonomous to enforce generated confirms/simulations.", command, args);
    }

    const here = fileURLToPath(import.meta.url);
    const executions = [];
    for (const p of planned) {
      const childArgs = [here, "nft", "buy", "--quote", p.quoteId, "--execute", "--autonomous", "--json"];
      if (agentId) childArgs.push("--agent-id", agentId);
      if (agentToken) childArgs.push("--agent-token", agentToken);
      const child = spawnSync(process.execPath, childArgs, {
        cwd: process.cwd(),
        encoding: "utf8",
        env: process.env,
      });
      let parsed = null;
      try {
        parsed = JSON.parse(String(child.stdout || "").trim() || "{}");
      } catch {}
      executions.push({
        quoteId: p.quoteId,
        collection: p.collection,
        tokenId: p.tokenId,
        ok: child.status === 0 && Boolean(parsed?.ok !== false),
        txHash: parsed?.txHash || null,
        error: child.status === 0 ? null : (parsed?.error || String(child.stderr || "execute failed").trim()),
      });
    }
    const failed = executions.filter((x) => !x.ok);
    const result = {
      ok: failed.length === 0,
      execute: true,
      autonomous: true,
      constraints: { count, scanLimit, minPrice, maxPrice, budget: budget > 0 ? budget : null, currency, dataSource, includeDisabled },
      scannedCollections: universe.length,
      candidateCount: candidates.length,
      selectedCount: selected.length,
      executedCount: executions.length - failed.length,
      failedCount: failed.length,
      executions,
      skipped,
    };
    emit({
      eventType: failed.length === 0 ? "nft.autobuy.executed" : "nft.autobuy.partial",
      command,
      dryRun: false,
      payload: args,
      result,
      ok: failed.length === 0,
      error: failed.length === 0 ? null : "one or more autobuy executions failed",
    });
    return print(result, asJson);
  }

  if (group === "nft" && sub === "quote-buy") {
    const collection = args.collection;
    const tokenId = args.tokenId;
    const maxPrice = Number(args.maxPrice);
    const currency = String(args.currency || "APE").toUpperCase();
    if (!collection || !tokenId || Number.isNaN(maxPrice)) {
      fail("Required: --collection --tokenId --maxPrice", command, args);
    }
    if (maxPrice <= 0) fail("--maxPrice must be > 0", command, args);
    const policyCheck = enforceBuyPolicy({
      policy,
      collection,
      maxPrice,
      currency,
      allowUnsafe: Boolean(args["allow-unsafe"]),
      allowlist,
    });
    if (!policyCheck.ok) fail(policyCheck.errors.join(" "), command, args);
    const target = policyCheck.target || resolveCollectionTarget(collection, allowlist).exact;
    const resolvedCollection = target?.contractAddress || target?.slug || collection;

    let liveListing = null;
    try {
      const listingsOut = await getListings({
        collection: target?.slug || collection,
        tokenId,
        maxPrice,
        dataSource: args.dataSource || policy.market.dataSource,
        apiKey: openseaKey,
        slugOverrides,
      });
      const candidates = listingsOut.listings || [];
      liveListing =
        candidates.find((l) => String(l.tokenId) === String(tokenId)) ||
        candidates[0] ||
        null;
    } catch (err) {
      fail(`Live listing lookup failed: ${err.message}`, command, args);
    }
    if (!liveListing) {
      fail(`No live listing found for collection=${collection} tokenId=${tokenId} under maxPrice=${maxPrice}.`, command, args);
    }

    const quoteId = randomId("q");
    const priceApe = Number(liveListing.priceApe);
    if (!Number.isFinite(priceApe) || priceApe <= 0) {
      fail("Invalid live listing price returned by market provider.", command, args);
    }
    const quote = {
      quoteId,
      collection,
      collectionTarget: resolvedCollection,
      tokenId,
      currency,
      priceApe,
      maxPrice,
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      listingId: liveListing.listingId,
      orderHash: liveListing.orderHash || randomId("order"),
      routeHash: liveListing.source || "opensea",
      source: liveListing.source || "opensea",
      protocolAddress: liveListing.protocolAddress || "0x0000000000000068f116a894984e2db1123eb395",
      assetContractAddress: liveListing.assetContractAddress || target?.contractAddress || null,
      chainId: Number(policy.apechainChainId || 33139),
      dryRunDefault: true,
    };
    const quotes = loadState(QUOTES_PATH);
    quotes[quoteId] = quote;
    writeJson(QUOTES_PATH, quotes);

    emit({
      eventType: "nft.quote.created",
      command,
      dryRun: true,
      payload: { collection, tokenId, maxPrice, currency, allowUnsafe: Boolean(args["allow-unsafe"]) },
      result: quote,
    });
    return print(quote, asJson);
  }

  if (group === "nft" && sub === "simulate") {
    const quoteId = args.quote;
    if (!quoteId) fail("--quote is required", command, args);
    const quotes = loadState(QUOTES_PATH);
    const quote = quotes[quoteId];
    if (!quote) fail(`Unknown quote ${quoteId}`, command, args);
    const ok = new Date(quote.expiresAt).getTime() > Date.now();
    quote.simulation = {
      ok,
      simulatedAt: new Date().toISOString(),
      reason: ok ? "simulation_passed" : "quote_expired",
    };
    quotes[quoteId] = quote;
    writeJson(QUOTES_PATH, quotes);
    const result = { quoteId, ok, reason: ok ? "simulation_passed" : "quote_expired" };
    emit({
      eventType: ok ? "nft.simulation.passed" : "nft.simulation.failed",
      command,
      dryRun: true,
      payload: { quoteId },
      result,
      ok,
      error: ok ? null : "quote expired",
    });
    if (!ok) process.exit(1);
    return print(result, asJson);
  }

  if (group === "nft" && sub === "buy") {
    const quoteId = args.quote;
    if (!quoteId) fail("--quote is required", command, args);
    const execute = Boolean(args.execute);
    const autonomous = Boolean(args.autonomous);
    const quotes = loadState(QUOTES_PATH);
    const quote = quotes[quoteId];
    if (!quote) fail(`Unknown quote ${quoteId}`, command, args);
    if (quote.executed) fail("Quote already executed. Generate a fresh quote.", command, { quoteId });
    if (new Date(quote.expiresAt).getTime() <= Date.now()) {
      fail("Quote expired. Generate a fresh quote.", command, { quoteId });
    }
    if (!execute) {
      const result = { dryRun: true, message: "No broadcast. Pass --execute to send transaction.", quote };
      emit({ eventType: "nft.buy.dry_run", command, dryRun: true, payload: { quoteId }, result });
      return print(result, asJson);
    }
    if (policy.nftBuy.simulationRequired && autonomous) {
      const ok = new Date(quote.expiresAt).getTime() > Date.now();
      quote.simulation = {
        ok,
        simulatedAt: new Date().toISOString(),
        reason: ok ? "simulation_passed" : "quote_expired",
      };
      quotes[quoteId] = quote;
      writeJson(QUOTES_PATH, quotes);
      const simResult = { quoteId, ok, reason: ok ? "simulation_passed" : "quote_expired", autonomous: true };
      emit({
        eventType: ok ? "nft.simulation.passed" : "nft.simulation.failed",
        command,
        dryRun: false,
        payload: { quoteId, autonomous: true },
        result: simResult,
        ok,
        error: ok ? null : "quote expired",
      });
      if (!ok) fail("Quote expired. Generate a fresh quote.", command, { quoteId, autonomous: true });
    }
    if (policy.nftBuy.simulationRequired && !quote.simulation?.ok) {
      fail("Simulation required before execute. Run: ape-claw nft simulate --quote <id> --json", command, {
        quoteId,
      });
    }
    if (policy.execution.confirmPhraseRequired) {
      const expected = expectedBuyConfirmPhrase(quote);
      const got = autonomous ? expected : String(args.confirm || "");
      if (got !== expected) {
        fail(`Confirmation phrase mismatch. Use --confirm "${expected}"`, command, { quoteId });
      }
    }
    const today = isoDay();
    const bridgeRequests = loadState(BRIDGE_REQUESTS_PATH);
    const spentNft = spentTodayFromQuotes(quotes, today);
    const spentBridge = spentTodayFromBridge(bridgeRequests, today);
    const spentToday = spentNft + spentBridge;
    const projected = spentToday + (Number(quote.priceApe) || 0);
    const cap = Number(policy.execution.dailySpendCap || 0);
    if (cap > 0 && projected > cap) {
      fail(`Daily spend cap exceeded (${projected.toFixed(2)} > ${cap} APE, including bridge).`, command, {
        quoteId,
        spentNft,
        spentBridge,
        projected,
        cap,
      });
    }
    if (!openseaKey) {
      fail("OPENSEA_API_KEY is required for live nft execute (fulfillment data).", command, { quoteId });
    }
    if (!privateKey) {
      fail(
        "APE_CLAW_PRIVATE_KEY is required for live nft execute. Set env var, save once with `ape-claw auth set --private-key 0x... --json`, or map your OpenClaw bot wallet secret to APE_CLAW_PRIVATE_KEY.",
        command,
        { quoteId },
      );
    }

    const chainId = Number(quote.chainId || policy.apechainChainId || 33139);
    const rpcUrl = await resolveRpcUrl(chainId, policy);
    const fulfillerAddress = String(args.user || "");
    const confirmedPrice = Number(quote.priceApe);
    const maxRetries = 3;
    let fulfillment = null;
    let usedOrderHash = quote.orderHash;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        fulfillment = await getListingFulfillmentData({
          apiKey: openseaKey,
          orderHash: usedOrderHash,
          protocolAddress: quote.protocolAddress || "0x0000000000000068f116a894984e2db1123eb395",
          chainId,
          fulfillerAddress: fulfillerAddress || undefined,
          privateKey,
          assetContractAddress: quote.assetContractAddress || undefined,
          tokenId: quote.tokenId,
        });
        break;
      } catch (err) {
        const isOrderNotFound = /order not found/i.test(err.message);
        if (!isOrderNotFound || attempt >= maxRetries) throw err;
        // Order was sniped/cancelled — re-fetch a fresh listing for the same collection+token
        // SAFETY: only accept replacement listings at or below the confirmed price
        emit({
          eventType: "nft.buy.retry",
          command,
          dryRun: false,
          payload: { quoteId, attempt, reason: "order_not_found", oldOrderHash: usedOrderHash, confirmedPrice },
          ok: true,
        });
        try {
          const fresh = await getListings({
            collection: quote.collectionTarget || quote.collection,
            tokenId: quote.tokenId,
            maxPrice: confirmedPrice,
            dataSource: policy.market.dataSource,
            apiKey: openseaKey,
            slugOverrides,
          });
          const candidates = fresh.listings || [];
          const match =
            candidates.find((l) => String(l.tokenId) === String(quote.tokenId) && Number(l.priceApe) <= confirmedPrice) ||
            candidates.find((l) => Number(l.priceApe) <= confirmedPrice) ||
            null;
          if (!match) throw new Error(`No replacement listing found at or below confirmed price (${confirmedPrice} APE).`);
          usedOrderHash = match.orderHash;
          quote.orderHash = match.orderHash;
          quote.listingId = match.listingId;
          quote.priceApe = match.priceApe;
          quote.assetContractAddress = match.assetContractAddress || quote.assetContractAddress;
          quote.protocolAddress = match.protocolAddress || quote.protocolAddress;
        } catch (refreshErr) {
          throw new Error(`Original order sniped and refresh failed: ${refreshErr.message}`);
        }
      }
    }
    if (!fulfillment) fail("Failed to get fulfillment data after retries.", command, { quoteId });
    const sent = await executeListingFulfillmentTx({
      fulfillmentData: fulfillment,
      privateKey,
      rpcUrl,
    });
    quote.executed = true;
    quote.executedAt = new Date().toISOString();
    quote.txHash = sent.txHash;
    quote.seaport = {
      chainId: sent.chainId,
      to: sent.to,
      functionName: sent.functionName,
    };
    quotes[quoteId] = quote;
    writeJson(QUOTES_PATH, quotes);
    const result = {
      ok: true,
      quoteId,
      txHash: sent.txHash,
      chainId: sent.chainId,
      quote: {
        quoteId: quote.quoteId,
        collection: quote.collection,
        collectionTarget: quote.collectionTarget,
        tokenId: quote.tokenId,
        priceApe: quote.priceApe,
        currency: quote.currency,
        listingId: quote.listingId,
        orderHash: quote.orderHash,
        source: quote.source,
      },
    };
    emit({
      eventType: "nft.buy.confirmed",
      command,
      dryRun: false,
      payload: {
        quoteId,
        collection: quote.collection,
        tokenId: quote.tokenId,
        priceApe: quote.priceApe,
        currency: quote.currency,
        autonomous,
      },
      result,
    });
    return print(result, asJson);
  }

  if (group === "bridge" && sub === "quote") {
    const from = String(args.from || "");
    const to = String(args.to || policy.bridge.defaultTo || "apechain");
    const token = String(args.token || policy.bridge.defaultToken || "APE");
    const amount = Number(args.amount);
    if (!from || Number.isNaN(amount)) {
      fail("Required: --from --amount (defaults: --to apechain --token APE)", command, args);
    }
    if (amount <= 0) fail("--amount must be > 0", command, args);
    if (String(policy.bridge.provider || "").toLowerCase() !== "relay") {
      fail(`Unsupported bridge provider: ${policy.bridge.provider}. Set bridge.provider=relay.`, command, args);
    }
    const req = await quoteBridgeRelay({
      from,
      to,
      token,
      amount,
      args,
      apiKey: relayApiKey,
      privateKey,
    });
    const feeBpsForPolicy = req.feeBps ?? 0;
    const check = enforceBridgePolicy({ policy, feeBps: feeBpsForPolicy });
    if (!check.ok) fail(check.errors.join(" "), command, args);
    const requests = loadState(BRIDGE_REQUESTS_PATH);
    requests[req.requestId] = req;
    writeJson(BRIDGE_REQUESTS_PATH, requests);
    emit({ eventType: "bridge.quote.created", command, dryRun: true, payload: args, result: req });
    return print(req, asJson);
  }

  if (group === "bridge" && sub === "execute") {
    const requestId = args.request;
    if (!requestId) fail("--request is required", command, args);
    const execute = Boolean(args.execute);
    const autonomous = Boolean(args.autonomous);
    const requests = loadState(BRIDGE_REQUESTS_PATH);
    const req = requests[requestId];
    if (!req) fail(`Unknown request ${requestId}`, command, args);
    if (req.status === "confirmed") fail("Bridge request already executed.", command, { requestId });
    if (new Date(req.expiresAt).getTime() <= Date.now()) fail("Bridge quote expired.", command, { requestId });
    if (!execute) {
      const result = { dryRun: true, message: "No broadcast. Pass --execute to bridge.", request: req };
      emit({ eventType: "bridge.execute.dry_run", command, dryRun: true, payload: { requestId }, result });
      return print(result, asJson);
    }
    if (policy.execution.confirmPhraseRequired) {
      const expected = expectedBridgeConfirmPhrase(req);
      const got = autonomous ? expected : String(args.confirm || "");
      if (got !== expected) {
        fail(`Confirmation phrase mismatch. Use --confirm "${expected}"`, command, { requestId });
      }
    }
    if (!privateKey) {
      fail(
        "APE_CLAW_PRIVATE_KEY is required for live bridge execute. Set env var, save once with `ape-claw auth set --private-key 0x... --json`, or map your OpenClaw bot wallet secret to APE_CLAW_PRIVATE_KEY.",
        command,
        { requestId },
      );
    }
    const today = isoDay();
    const quotes = loadState(QUOTES_PATH);
    const spentNft = spentTodayFromQuotes(quotes, today);
    const spentBridge = spentTodayFromBridge(requests, today);
    const projectedBridge = spentNft + spentBridge + (Number(req.amount) || 0);
    const cap = Number(policy.execution.dailySpendCap || 0);
    if (cap > 0 && projectedBridge > cap) {
      fail(`Daily spend cap exceeded (${projectedBridge.toFixed(2)} > ${cap} APE, including bridge).`, command, {
        requestId,
        spentNft,
        spentBridge,
        projectedBridge,
        cap,
      });
    }
    const executed = await executeBridgeRelay({
      request: req,
      privateKey,
      policy,
    });
    requests[requestId] = executed;
    writeJson(BRIDGE_REQUESTS_PATH, requests);
    emit({
      eventType: "bridge.execute.confirmed",
      command,
      dryRun: false,
      payload: { requestId, autonomous },
      result: executed,
    });
    return print(executed, asJson);
  }

  if (group === "bridge" && sub === "status") {
    const requestId = args.request;
    if (!requestId) fail("--request is required", command, args);
    const requests = loadState(BRIDGE_REQUESTS_PATH);
    const req = requests[requestId];
    if (!req) fail(`Unknown request ${requestId}`, command, args);
    const status = await getBridgeRelayStatus({
      request: req,
      apiKey: relayApiKey,
    });
    const merged = {
      ...req,
      status: status.status || req.status,
      relayStatus: status.relayStatus || null,
      destinationTxHash: status.destinationTxHash || req.destinationTxHash || null,
      lastStatusCheckAt: new Date().toISOString(),
    };
    requests[requestId] = merged;
    writeJson(BRIDGE_REQUESTS_PATH, requests);
    emit({ eventType: "bridge.status.read", command, dryRun: true, payload: { requestId }, result: merged });
    return print(merged, asJson);
  }

  if (group === "allowlist" && sub === "audit") {
    const unresolved = allowlist.filter((c) => !c.contractAddress);
    // Check for slug collisions (real identity) instead of rank collisions
    const bySlug = new Map();
    const slugCollisions = [];
    for (const c of allowlist) {
      const slug = String(c.slug || "").toLowerCase();
      if (slug && bySlug.has(slug)) slugCollisions.push(slug);
      if (slug) bySlug.set(slug, c);
    }
    const result = {
      total: allowlist.length,
      unresolvedCount: unresolved.length,
      unresolved: unresolved.map((c) => ({ name: c.name, slug: c.slug })),
      slugCollisions,
    };
    emit({
      eventType: "allowlist.audit.ran",
      command,
      dryRun: true,
      result: { total: result.total, unresolvedCount: result.unresolvedCount, slugCollisions },
    });
    return print(result, asJson);
  }

  // ═══════════════════════════════════════════════════════════
  //  V2-ALPHA: ONCHAIN SKILLS (registry + intents)
  //  Additive only: does not change any v1 command behavior.
  // ═══════════════════════════════════════════════════════════
  if (group === "v2" && sub === "skill") {
    const action = args._[2];
    const rpcUrl = String(args.rpc || process.env.APE_CLAW_V2_RPC_URL || process.env.RPC_URL_33139 || "").trim();
    const pk = String(args.privateKey || process.env.APE_CLAW_V2_PRIVATE_KEY || "").trim();
    const skillNftAddress = String(args.skillNft || process.env.APE_CLAW_V2_SKILL_NFT || "").trim();
    const registryAddress = String(args.registry || process.env.APE_CLAW_V2_SKILL_REGISTRY || "").trim();

    if (!rpcUrl) return fail("Missing --rpc (or APE_CLAW_V2_RPC_URL / RPC_URL_33139)", command, args);
    if (!pk) return fail("Missing --privateKey (or APE_CLAW_V2_PRIVATE_KEY)", command, args);
    if (!skillNftAddress) return fail("Missing --skillNft (or APE_CLAW_V2_SKILL_NFT)", command, args);
    if (!registryAddress) return fail("Missing --registry (or APE_CLAW_V2_SKILL_REGISTRY)", command, args);

    const account = privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
    const publicClient = createPublicClient({ transport: http(rpcUrl) });
    const walletClient = createWalletClient({ transport: http(rpcUrl), account });

    const skillNft = getContract({ address: skillNftAddress, abi: SkillNFT_ABI, client: { public: publicClient, wallet: walletClient } });
    const registry = getContract({ address: registryAddress, abi: SkillRegistry_ABI, client: { public: publicClient, wallet: walletClient } });

    if (action === "mint") {
      const parentId = BigInt(args.parentId || 0);
      const royaltyReceiver = String(args["royalty-receiver"] || args.royaltyReceiver || "").trim();
      const royaltyBpsRaw = args["royalty-bps"] ?? args.royaltyBps;
      const royaltyBps = royaltyBpsRaw !== undefined && royaltyBpsRaw !== null && String(royaltyBpsRaw).trim() !== ""
        ? Number(royaltyBpsRaw)
        : 0;
      const useRoyalty = !!royaltyReceiver && Number.isFinite(royaltyBps) && royaltyBps > 0;

      const hash = useRoyalty
        ? await skillNft.write.mintSkillWithRoyalty([parentId, royaltyReceiver, royaltyBps])
        : await skillNft.write.mintSkill([parentId]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const nextId = await skillNft.read.nextSkillId();
      const skillId = BigInt(nextId) - 1n;
      const result = {
        ok: true,
        skillId: String(skillId),
        txHash: receipt.transactionHash,
        ...(useRoyalty ? { royaltyReceiver, royaltyBps } : {}),
      };
      emitEvent({ eventType: "v2.skill.minted", agentId: _agentId, command, dryRun: false, result });
      return print(result, asJson);
    }

    if (action === "publish") {
      const skillId = BigInt(args.skillId || 0);
      const file = String(args.file || "").trim();
      const uri = String(args.uri || (file ? `file://${path.resolve(file)}` : "")).trim();
      const riskTier = Number(args.riskTier || 1);
      if (!skillId) return fail("Missing --skillId", command, args);
      if (!file) return fail("Missing --file (skillcard json)", command, args);
      const obj = readSkillcardJson(file);
      const versionHash = computeSkillVersionHash(obj.version);
      const contentHash = computeSkillcardContentHash(obj);
      const txHash = await registry.write.publishVersion([skillId, versionHash, contentHash, uri, riskTier]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      const result = {
        ok: true,
        skillId: String(skillId),
        versionHash,
        contentHash,
        uri,
        txHash: receipt.transactionHash,
      };
      emitEvent({ eventType: "v2.skill.version.published", agentId: _agentId, command, dryRun: false, result });
      return print(result, asJson);
    }

    return fail("Unknown v2 skill action. Use: ape-claw v2 skill mint|publish", command, args);
  }

  if (group === "v2" && sub === "intent") {
    const action = args._[2];
    const rpcUrl = String(args.rpc || process.env.APE_CLAW_V2_RPC_URL || process.env.RPC_URL_33139 || "").trim();
    const pk = String(args.privateKey || process.env.APE_CLAW_V2_PRIVATE_KEY || "").trim();
    const intentsAddress = String(args.intents || process.env.APE_CLAW_V2_INTENT_REGISTRY || "").trim();
    if (!rpcUrl) return fail("Missing --rpc (or APE_CLAW_V2_RPC_URL / RPC_URL_33139)", command, args);
    if (!pk) return fail("Missing --privateKey (or APE_CLAW_V2_PRIVATE_KEY)", command, args);
    if (!intentsAddress) return fail("Missing --intents (or APE_CLAW_V2_INTENT_REGISTRY)", command, args);

    const account = privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
    const publicClient = createPublicClient({ transport: http(rpcUrl) });
    const walletClient = createWalletClient({ transport: http(rpcUrl), account });
    const intents = getContract({ address: intentsAddress, abi: IntentRegistry_ABI, client: { public: publicClient, wallet: walletClient } });

    if (action === "create") {
      const payload = String(args.payload || "").trim();
      const expiresAt = Number(args.expiresAt || 0);
      if (!payload) return fail("Missing --payload (stringified intent payload)", command, args);
      const intentHash = keccak256(toHex(payload));
      const txHash = await intents.write.createIntent([intentHash, expiresAt]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      const result = { ok: true, intentHash, txHash: receipt.transactionHash, expiresAt };
      emitEvent({ eventType: "v2.intent.created", agentId: _agentId, command, dryRun: false, result });
      return print(result, asJson);
    }

    if (action === "cancel") {
      const intentId = BigInt(args.intentId || 0);
      if (!intentId) return fail("Missing --intentId", command, args);
      const txHash = await intents.write.cancelIntent([intentId]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      const result = { ok: true, intentId: String(intentId), txHash: receipt.transactionHash };
      emitEvent({ eventType: "v2.intent.cancelled", agentId: _agentId, command, dryRun: false, result });
      return print(result, asJson);
    }

    return fail("Unknown v2 intent action. Use: ape-claw v2 intent create|cancel", command, args);
  }

  if (group === "v2" && sub === "receipt") {
    const action = args._[2];
    const rpcUrl = String(args.rpc || process.env.APE_CLAW_V2_RPC_URL || process.env.RPC_URL_33139 || "").trim();
    const pk = String(args.privateKey || process.env.APE_CLAW_V2_PRIVATE_KEY || "").trim();
    const receiptsAddress = String(args.receipts || process.env.APE_CLAW_V2_RECEIPT_REGISTRY || "").trim();
    if (!rpcUrl) return fail("Missing --rpc (or APE_CLAW_V2_RPC_URL / RPC_URL_33139)", command, args);
    if (!receiptsAddress) return fail("Missing --receipts (or APE_CLAW_V2_RECEIPT_REGISTRY)", command, args);

    const publicClient = createPublicClient({ transport: http(rpcUrl) });
    const receiptsRead = getContract({
      address: receiptsAddress,
      abi: ReceiptRegistry_ABI,
      client: { public: publicClient },
    });

    if (action === "record") {
      if (!pk) return fail("Missing --privateKey (or APE_CLAW_V2_PRIVATE_KEY)", command, args);
      const account = privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
      const walletClient = createWalletClient({ transport: http(rpcUrl), account });
      const receipts = getContract({
        address: receiptsAddress,
        abi: ReceiptRegistry_ABI,
        client: { public: publicClient, wallet: walletClient },
      });
      const traceId = String(args.traceId || args.trace || "").trim();
      if (!traceId) return fail("Missing --traceId", command, args);
      const subjectStr = String(args.subject || (_agentId ? `agent:${_agentId}` : "agent:unknown")).trim();
      const uri = String(args.uri || "").trim();
      const payloadStr = String(args.payload || "").trim();
      let payloadObj = {};
      if (payloadStr) {
        try {
          payloadObj = JSON.parse(payloadStr);
        } catch {
          return fail("Invalid --payload JSON string", command, args);
        }
      }

      const traceIdHash = keccak256(toHex(traceId));
      const contentHash = keccak256(toHex(stableJsonStringify({ subject: subjectStr, payload: payloadObj })));
      const subjectHash = keccak256(toHex(subjectStr));
      const txHash = await receipts.write.recordReceipt([traceIdHash, contentHash, subjectHash, uri]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      const result = {
        ok: true,
        traceId,
        traceIdHash,
        contentHash,
        subject: subjectStr,
        subjectHash,
        uri,
        txHash: receipt.transactionHash,
      };
      emitEvent({ eventType: "v2.receipt.recorded", agentId: _agentId, command, dryRun: false, result });
      return print(result, asJson);
    }

    if (action === "get") {
      const traceId = String(args.traceId || args.trace || "").trim();
      if (!traceId) return fail("Missing --traceId", command, args);
      const traceIdHash = keccak256(toHex(traceId));
      const isRecorded = await receiptsRead.read.isRecorded([traceIdHash]);
      const receipt = isRecorded ? await receiptsRead.read.getReceipt([traceIdHash]) : null;
      const result = {
        ok: true,
        traceId,
        traceIdHash,
        isRecorded: Boolean(isRecorded),
        receipt,
      };
      emitEvent({ eventType: "v2.receipt.read", agentId: _agentId, command, dryRun: true, result: { traceId, traceIdHash, isRecorded } });
      return print(result, asJson);
    }

    return fail("Unknown v2 receipt action. Use: ape-claw v2 receipt record|get", command, args);
  }

  // ── v2 vault (PodVault) ──
  if (group === "v2" && sub === "vault") {
    const action = String(args._[2] || "").toLowerCase();
    const rpcUrl = String(args.rpc || args.rpcUrl || process.env.APE_CLAW_V2_RPC_URL || "").trim();
    const vaultAddr = String(args.vault || args.podVault || process.env.APE_CLAW_V2_POD_VAULT || "").trim();
    if (!rpcUrl) return fail("Missing --rpc <url> or APE_CLAW_V2_RPC_URL", command, args);
    if (!vaultAddr) return fail("Missing --vault <address> or APE_CLAW_V2_POD_VAULT", command, args);

    const publicVault = createPublicClient({ transport: http(rpcUrl) });
    const vault = getContract({ address: vaultAddr, abi: PodVault_ABI, client: publicVault });

    if (action === "status") {
      const totalShares = await vault.read.totalShares();
      const totalReleased = await vault.read.totalReleasedNative();
      const mCount = await vault.read.memberCount();
      const balance = await publicVault.getBalance({ address: vaultAddr });
      const members = [];
      for (let i = 0n; i < mCount; i++) {
        const addr = await vault.read.memberAt([i]);
        const sh = await vault.read.shares([addr]);
        const pending = await vault.read.pendingNative([addr]);
        members.push({ address: addr, shares: sh.toString(), pendingNative: pending.toString() });
      }
      return print({
        ok: true,
        podVault: vaultAddr,
        totalShares: totalShares.toString(),
        totalReleasedNative: totalReleased.toString(),
        balance: balance.toString(),
        memberCount: Number(mCount),
        members,
      }, asJson);
    }

    if (action === "release") {
      const pk = String(args.privateKey || process.env.APE_CLAW_V2_PRIVATE_KEY || "").trim();
      const member = String(args.member || "").trim();
      if (!pk) return fail("Missing --privateKey or APE_CLAW_V2_PRIVATE_KEY", command, args);
      if (!member) return fail("Missing --member <address>", command, args);
      const account = privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
      const walletVault = createWalletClient({ account, transport: http(rpcUrl) });
      const wVault = getContract({ address: vaultAddr, abi: PodVault_ABI, client: walletVault });
      const tx = await wVault.write.releaseNative([member]);
      await publicVault.waitForTransactionReceipt({ hash: tx });
      emitEvent({ eventType: "v2.vault.release", agentId: _agentId, command, result: { tx, member } });
      return print({ ok: true, tx, member, action: "releaseNative" }, asJson);
    }

    return fail("Unknown v2 vault action. Use: ape-claw v2 vault status|release", command, args);
  }

  // ── v2 agent (AgentAccount) ──
  if (group === "v2" && sub === "agent") {
    const action = String(args._[2] || "").toLowerCase();
    if (action === "execute") {
      const rpcUrl = String(args.rpc || args.rpcUrl || process.env.APE_CLAW_V2_RPC_URL || "").trim();
      const pk = String(args.privateKey || process.env.APE_CLAW_V2_PRIVATE_KEY || "").trim();
      const agentAddr = String(args.agentAccount || process.env.APE_CLAW_V2_AGENT_ACCOUNT || "").trim();
      const moduleAddr = String(args.module || "").trim();
      const inputData = String(args.input || "0x").trim();
      const value = String(args.value || "0").trim();
      const traceId = String(args.traceId || `agent_exec_${Date.now()}`).trim();
      const subject = String(args.subject || `agent:${_agentId}`).trim();
      const uri = String(args.uri || "").trim();

      if (!rpcUrl) return fail("Missing --rpc", command, args);
      if (!pk) return fail("Missing --privateKey", command, args);
      if (!agentAddr) return fail("Missing --agentAccount or APE_CLAW_V2_AGENT_ACCOUNT", command, args);
      if (!moduleAddr) return fail("Missing --module <address>", command, args);

      const account = privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
      const pub = createPublicClient({ transport: http(rpcUrl) });
      const wallet = createWalletClient({ account, transport: http(rpcUrl) });
      const agentContract = getContract({ address: agentAddr, abi: AgentAccount_ABI, client: wallet });

      const traceIdHash = keccak256(toHex(traceId));
      const subjectHash = keccak256(toHex(subject));

      const tx = await agentContract.write.executeSkill([
        moduleAddr,
        inputData,
        BigInt(value),
        traceIdHash,
        subjectHash,
        uri,
      ], { value: BigInt(value) });
      await pub.waitForTransactionReceipt({ hash: tx });
      emitEvent({ eventType: "v2.agent.execute", agentId: _agentId, command, result: { tx, module: moduleAddr, traceId } });
      return print({ ok: true, tx, module: moduleAddr, traceId, traceIdHash, subjectHash }, asJson);
    }
    return fail("Unknown v2 agent action. Use: ape-claw v2 agent execute", command, args);
  }

  if (group === "pod" && sub === "init") {
    const target = String(args.dir || "./pod-workspace").trim();
    const templatesDir = path.join(process.cwd(), "pod", "templates");
    try {
      const result = initPodWorkspace({ targetDir: target, templatesDir });
      emitEvent({ eventType: "pod.init.completed", agentId: _agentId, command, dryRun: false, result });
      return print(result, asJson);
    } catch (err) {
      return fail(err.message || "pod init failed", command, args);
    }
  }

  const helpObj = {
    ok: false,
    error: `Unknown command: ${args._.join(" ")}`,
    commands: {
      doctor: "ape-claw doctor --json",
      quickstart: "ape-claw quickstart --json",
      "clawbot register": "ape-claw clawbot register --agent-id <id> --name <name> [--api https://api.apeclaw.ai --invite <token>] [--registration-key <key>] --json",
      "clawbot list": "ape-claw clawbot list --json",
      "auth set": "ape-claw auth set [--agent-id <id>] [--agent-token <token>] [--opensea-api-key <key>] [--private-key <pk>] --json",
      "auth show": "ape-claw auth show --json",
      "auth clear": "ape-claw auth clear --field <agent-id|agent-token|opensea-api-key|private-key> --json",
      "chain info": "ape-claw chain info --json",
      "market collections": "ape-claw market collections --recommended --json",
      "market listings": "ape-claw market listings --collection <slug> --maxPrice <n> --json",
      "nft autobuy": "ape-claw nft autobuy --count <n> [--minPrice <n>] --maxPrice <n> [--budget <n>] [--scan <n>] [--all] --json",
      "nft autobuy (execute)": "ape-claw nft autobuy --count <n> [--minPrice <n>] --maxPrice <n> --execute --autonomous --json",
      "nft quote-buy": "ape-claw nft quote-buy --collection <slug> --tokenId <id> --maxPrice <n> --currency APE --json",
      "nft simulate": "ape-claw nft simulate --quote <quoteId> --json",
      "nft buy": 'ape-claw nft buy --quote <quoteId> --execute --confirm "BUY <collection> #<tokenId> <priceApe> APE" --json',
      "nft buy (autonomous)": "ape-claw nft buy --quote <quoteId> --execute --autonomous --json",
      "bridge quote": "ape-claw bridge quote --from <chain> --amount <n> --json",
      "bridge execute": 'ape-claw bridge execute --request <requestId> --execute --confirm "BRIDGE <amount> <token> <from>-><to>" --json',
      "bridge execute (autonomous)": "ape-claw bridge execute --request <requestId> --execute --autonomous --json",
      "bridge status": "ape-claw bridge status --request <requestId> --json",
      "allowlist audit": "ape-claw allowlist audit --json",
      "skill install": "ape-claw skill install [<slug>] [--scope local] [--starter-pack | --no-starter-pack] [--allow-unvetted] [--allow-high-risk] [--allow-custom-api] [--allow-insecure-api] --json",
      "v2 skill mint": "ape-claw v2 skill mint --rpc <url> --privateKey 0x... --skillNft 0x... --registry 0x... [--parentId 0] [--royalty-receiver 0x... --royalty-bps 500] --json",
      "v2 skill publish": "ape-claw v2 skill publish --rpc <url> --privateKey 0x... --registry 0x... --skillId <id> --file <skillcard.json> [--uri ipfs://...] [--riskTier 1] --json",
      "v2 intent create": "ape-claw v2 intent create --rpc <url> --privateKey 0x... --intents 0x... --payload '{...}' [--expiresAt <unixSec>] --json",
      "v2 intent cancel": "ape-claw v2 intent cancel --rpc <url> --privateKey 0x... --intents 0x... --intentId <id> --json",
      "v2 receipt record": "ape-claw v2 receipt record --rpc <url> --privateKey 0x... --receipts 0x... --traceId <trace> [--subject <string>] [--payload '{...}'] [--uri ipfs://...] --json",
      "v2 receipt get": "ape-claw v2 receipt get --rpc <url> --receipts 0x... --traceId <trace> --json",
      "v2 vault status": "ape-claw v2 vault status --rpc <url> --vault 0x... --json",
      "v2 vault release": "ape-claw v2 vault release --rpc <url> --privateKey 0x... --vault 0x... --member 0x... --json",
      "v2 agent execute": "ape-claw v2 agent execute --rpc <url> --privateKey 0x... --agentAccount 0x... --module 0x... [--input 0x...] [--value 0] [--traceId ...] --json",
      "pod init": "ape-claw pod init --dir ./pod-workspace --json",
    },
    globalFlags: {
      "--json": "Recommended for deterministic parsing (all output as JSON).",
      "--agent-id <id>": "Clawbot agent ID (or APE_CLAW_AGENT_ID env var).",
      "--agent-token <token>": "Clawbot auth token (or APE_CLAW_AGENT_TOKEN env var).",
      "--opensea-api-key <key>": "For auth set: persist OpenSea key in local auth profile.",
      "--private-key <pk>": "For auth set: persist wallet private key in local auth profile.",
    },
    note: "Global flags (--agent-id, --agent-token, --json) can appear anywhere in the command.",
  };
  if (asJson) {
    console.log(JSON.stringify(helpObj, null, 2));
  } else {
    console.log(`Unknown command: ${args._.join(" ")}\n`);
    console.log("Commands:");
    for (const [name, example] of Object.entries(helpObj.commands)) {
      console.log(`  ${name.padEnd(22)} ${example}`);
    }
    console.log("\nGlobal flags: --json --agent-id <id> --agent-token <token>");
    console.log("Note: global flags can appear anywhere in the command.\n");
  }
  process.exit(1);
}

main().catch((err) => {
  console.error(err.message || String(err));
  process.exit(1);
});

