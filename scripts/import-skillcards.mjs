import fs from "node:fs";
import path from "node:path";
import {
  computeSkillcardContentHash,
  computeSkillVersionHash,
  readSkillcardJson,
} from "../src/lib/v2-skillcard.mjs";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SkillNFT_ABI, SkillRegistry_ABI } from "../src/lib/v2-onchain-abi.mjs";

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function safeSlug(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getByPath(root, pathExpr) {
  const p = String(pathExpr || "").trim();
  if (!p) return undefined;
  const parts = p.split(".").map((s) => s.trim()).filter(Boolean);
  let cur = root;
  for (const part of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    if (!(part in cur)) return undefined;
    cur = cur[part];
  }
  return cur;
}

function coerceRiskTier(skillcard, fallback = 2) {
  const v = skillcard?.constraints?.riskTier;
  if (typeof v === "number" && Number.isFinite(v)) {
    const n = Math.max(0, Math.min(255, Math.floor(v)));
    return n;
  }
  // Back-compat: allow string labels.
  if (typeof v === "string") {
    const s = v.toLowerCase().trim();
    if (s === "high") return 3;
    if (s === "medium" || s === "med") return 2;
    if (s === "low") return 1;
    if (s === "unknown") return 0;
  }
  const f = Number(fallback);
  if (Number.isFinite(f)) return Math.max(0, Math.min(255, Math.floor(f)));
  return 2;
}

function buildStubSkillcard(src, { url }) {
  const name = String(src.name || "Unnamed Skill").trim();
  const slug = safeSlug(src.slug || name);
  const riskTier = Number(src.riskTier || 2);
  const u = String(url || src.url || "").trim();

  return {
    name,
    slug,
    description: `Imported reference from ${src.source || "source"}: ${u}`,
    version: String(src.version || "1.0.0"),
    inputs_schema: { type: "object", properties: {} },
    outputs_schema: { type: "object", properties: {} },
    bindings: u ? [{ type: "external", url: u }] : [],
    constraints: {
      riskTier,
      importedStub: true,
      notes: [
        "Imported as a stub SkillCard because a full SkillCard payload was not extractable from the source.",
        "Provide a direct JSON SkillCard URL (e.g., GitHub raw) in skillcards/import-sources.json to enable full import.",
      ],
    },
    required_permissions: ["unknown"],
    examples: [],
    eval_packs: [],
    provenance: {
      publisher: "apeclaw-importer",
      signed: false,
      source: src.source || "unknown",
      sourceUrl: u,
      importedAt: new Date().toISOString(),
    },
  };
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      out._.push(a);
      continue;
    }
    const k = a.slice(2);
    if (k === "publish") {
      out.publish = true;
      continue;
    }
    if (k === "strict" || k === "requireSkillcard") {
      out.strict = true;
      continue;
    }
    if (k === "skipStubs" || k === "skip-stubs") {
      out.skipStubs = true;
      continue;
    }
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) {
      out[k] = true;
      continue;
    }
    out[k] = v;
    i++;
  }
  return out;
}

function isProbablyJsonUrl(u) {
  const s = String(u || "");
  return /\.json(\?|#|$)/i.test(s) || /raw\.githubusercontent\.com/i.test(s);
}

function makeGithubRawUrl(src) {
  if (!src || src.source !== "github") return "";
  const owner = String(src.owner || "").trim();
  const repo = String(src.repo || "").trim();
  const ref = String(src.ref || "main").trim();
  const filePath = String(src.path || "").trim().replace(/^\/+/, "");
  if (!owner || !repo || !ref || !filePath) return "";
  return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${filePath}`;
}

async function fetchText(url, { timeoutMs = 15000 } = {}) {
  const u = String(url || "").trim();
  if (!u) throw new Error("missing url");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(u, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "user-agent": "apeclaw-skillcard-importer/1.0" },
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } finally {
    clearTimeout(t);
  }
}

async function fetchJson(url, opts = {}) {
  const { ok, status, text } = await fetchText(url, opts);
  if (!ok) return { ok: false, status, error: "fetch_failed", json: null, url };
  try {
    return { ok: true, status, json: JSON.parse(text), url };
  } catch (e) {
    return { ok: false, status, error: "invalid_json", json: null, url };
  }
}

function tryExtractNextJsData(html) {
  const s = String(html || "");
  // Next.js: <script id="__NEXT_DATA__" type="application/json">...</script>
  const m = s.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (!m) return null;
  const raw = m[1] || "";
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function looksLikeSkillcard(obj) {
  if (!obj || typeof obj !== "object") return false;
  const hasCore = typeof obj.name === "string" && typeof obj.slug === "string" && typeof obj.version === "string";
  const hasSchemas = !!obj.inputs_schema || !!obj.outputs_schema;
  const hasBindings = Array.isArray(obj.bindings);
  return hasCore && (hasSchemas || hasBindings);
}

function findFirstSkillcardLike(root, { maxNodes = 25000 } = {}) {
  const seen = new Set();
  let nodes = 0;
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== "object") continue;
    if (seen.has(cur)) continue;
    seen.add(cur);
    nodes++;
    if (nodes > maxNodes) return null;
    if (looksLikeSkillcard(cur)) return cur;
    if (Array.isArray(cur)) {
      for (const v of cur) stack.push(v);
      continue;
    }
    for (const k of Object.keys(cur)) stack.push(cur[k]);
  }
  return null;
}

function normalizeImportedSkillcard(obj, src, { sourceUrl }) {
  const sc = obj && typeof obj === "object" ? obj : {};
  const name = String(sc.name || src.name || "Unnamed Skill").trim();
  const slug = safeSlug(sc.slug || src.slug || name);
  const version = String(sc.version || src.version || "1.0.0").trim() || "1.0.0";
  const riskTier = coerceRiskTier(sc, src.riskTier ?? 2);

  // Ensure consistent provenance and constraints.
  const prov = {
    ...(sc.provenance && typeof sc.provenance === "object" ? sc.provenance : {}),
    publisher: "apeclaw-importer",
    signed: false,
    source: src.source || "unknown",
    // Preserve per-skill provenance if the source provided it (e.g. GitHub webUrl/rawUrl).
    sourceUrl: String(sc?.provenance?.sourceUrl || sourceUrl || src.url || "").trim(),
    importedAt: new Date().toISOString(),
  };

  const out = {
    ...sc,
    name,
    slug,
    version,
    constraints: { ...(sc.constraints || {}), riskTier },
    provenance: prov,
  };

  // Defensive defaults for common fields.
  if (!out.inputs_schema) out.inputs_schema = { type: "object", properties: {} };
  if (!out.outputs_schema) out.outputs_schema = { type: "object", properties: {} };
  if (!Array.isArray(out.bindings)) out.bindings = [];
  if (!Array.isArray(out.required_permissions)) out.required_permissions = [];
  if (!Array.isArray(out.examples)) out.examples = [];
  if (!Array.isArray(out.eval_packs)) out.eval_packs = [];

  return out;
}

function assessSkillcardSafety(skillcard) {
  // Heuristic safety review: block obvious destructive payloads and quarantine anything
  // that looks like exfiltration, privilege escalation, persistence, or RCE patterns.
  const sc = skillcard && typeof skillcard === "object" ? skillcard : {};
  const bindings = Array.isArray(sc.bindings) ? sc.bindings : [];
  const textParts = [];
  const push = (v) => {
    if (v === undefined || v === null) return;
    textParts.push(String(v));
  };
  push(sc.name);
  push(sc.slug);
  push(sc.description);
  try { push(JSON.stringify(sc.constraints || {})); } catch {}
  try { push(JSON.stringify(sc.required_permissions || [])); } catch {}
  for (const b of bindings) {
    if (!b || typeof b !== "object") continue;
    push(b.type);
    push(b.command);
    push(b.url);
    try { push(JSON.stringify(b)); } catch {}
  }
  const blob = textParts.join("\n");

  const signals = [];
  const hit = (id, re) => {
    try { if (re.test(blob)) signals.push(id); } catch {}
  };

  // Destructive/bricking.
  hit("rm_rf", /\brm\s+-rf\b/i);
  hit("mkfs", /\bmkfs(\.| )/i);
  hit("dd_disk", /\bdd\s+if=\/dev\/(zero|random)\b/i);
  hit("fork_bomb", /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/);

  // Remote code execution / suspicious piping.
  hit("curl_pipe_bash", /\b(curl|wget)\b[^\n]*\|\s*(bash|sh)\b/i);
  hit("eval_base64_pipe", /\b(base64\s+-d|openssl\s+base64)\b[\s\S]*\|\s*(bash|sh)\b/i);
  hit("bash_c", /\bbash\s+-c\b/i);
  hit("powershell", /\bpowershell\b/i);

  // Persistence / priv escalation.
  hit("sudo", /\bsudo\b/i);
  hit("cron", /\b(crontab|\/etc\/cron|cron\.d)\b/i);
  hit("launchctl", /\blaunchctl\b/i);
  hit("systemd", /\b(systemctl|\/etc\/systemd)\b/i);

  // Exfil / webhook patterns.
  hit("discord_webhook", /discord\.com\/api\/webhooks/i);
  hit("slack_webhook", /hooks\.slack\.com\/services/i);
  hit("pastebin", /pastebin\.com/i);
  hit("ngrok", /\bngrok\b/i);

  // Secrets mentioned (not always malicious, but should be manually reviewed).
  hit("secrets_keywords", /\b(privateKey|mnemonic|seed phrase|api[_-]?key|bearer\s+|authorization:|x-agent-token)\b/i);

  const hardBlock = ["rm_rf", "mkfs", "dd_disk", "fork_bomb"].some((s) => signals.includes(s));
  if (hardBlock) return { verdict: "block", ok: false, signals, reasons: signals };

  const needsReview = [
    "curl_pipe_bash",
    "eval_base64_pipe",
    "discord_webhook",
    "slack_webhook",
    "pastebin",
    "ngrok",
    "sudo",
    "cron",
    "launchctl",
    "systemd",
    "secrets_keywords",
    "powershell",
    "bash_c",
  ].some((s) => signals.includes(s));
  if (needsReview) return { verdict: "review", ok: false, signals, reasons: signals };

  return { verdict: "allow", ok: true, signals: [], reasons: [] };
}

function safeVersionForFile(v) {
  return String(v || "0.0.0")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.\-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseFrontmatter(md) {
  const s = String(md || "");
  if (!s.startsWith("---")) return { front: {}, body: s };
  const end = s.indexOf("\n---", 3);
  if (end === -1) return { front: {}, body: s };
  const rawFront = s.slice(3, end).trim();
  const body = s.slice(end + "\n---".length).replace(/^\s*\n/, "");

  const front = {};
  let currentKey = "";
  for (const line of rawFront.split("\n")) {
    const l = line.replace(/\r/g, "");
    if (!l.trim() || l.trim().startsWith("#")) continue;
    const m = l.match(/^([A-Za-z0-9_\-]+)\s*:\s*(.*)\s*$/);
    if (m) {
      currentKey = m[1];
      const v = m[2] || "";
      if (!v) {
        front[currentKey] = [];
        continue;
      }
      const vv = v.trim();
      if ((vv.startsWith("{") && vv.endsWith("}")) || (vv.startsWith("[") && vv.endsWith("]"))) {
        try { front[currentKey] = JSON.parse(vv); continue; } catch (e) {}
      }
      if (vv === "true" || vv === "false") { front[currentKey] = vv === "true"; continue; }
      if (/^\d+(\.\d+)?$/.test(vv)) { front[currentKey] = Number(vv); continue; }
      front[currentKey] = vv.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
      continue;
    }
    const li = l.match(/^\s*-\s+(.*)$/);
    if (li && currentKey && Array.isArray(front[currentKey])) {
      front[currentKey].push(li[1].trim());
    }
  }
  return { front, body };
}

function firstParagraph(mdBody) {
  const s = String(mdBody || "").trim();
  if (!s) return "";
  const lines = s.split("\n");
  const out = [];
  for (const ln of lines) {
    const t = ln.trim();
    if (!t) break;
    if (t.startsWith("#")) continue;
    out.push(t);
  }
  return out.join(" ").trim();
}

async function importOpenClawSkillsRepo(src) {
  // Fetch from openclaw/skills (a GitHub mirror of ClawHub skills).
  const owner = String(src.owner || "").trim();
  const skillSlug = String(src.skillSlug || src.skill || src.skillName || src.skillId || src.slug || "").trim();
  if (!owner || !skillSlug) {
    return { ok: false, mode: "openclaw_skills_repo", error: "missing_owner_or_skillSlug", sourceUrl: "" };
  }

  const repoOwner = String(src.repoOwner || "openclaw").trim();
  const repo = String(src.repo || "skills").trim();
  const ref = String(src.ref || "main").trim();
  const basePath = String(src.basePath || "skills").trim().replace(/^\/+|\/+$/g, "");
  const skillPath = `${basePath}/${owner}/${skillSlug}`;
  const rawBase = `https://raw.githubusercontent.com/${repoOwner}/${repo}/${ref}/${skillPath}`;
  const metaUrl = `${rawBase}/_meta.json`;
  const mdUrl = `${rawBase}/SKILL.md`;
  const webUrl = `https://github.com/${repoOwner}/${repo}/tree/${ref}/${skillPath}`;

  const metaRes = await fetchJson(metaUrl);
  const mdRes = await fetchText(mdUrl);

  const meta = metaRes.ok ? metaRes.json : {};
  const md = mdRes.ok ? mdRes.text : "";
  const fm = parseFrontmatter(md);

  const displayName = String(meta?.displayName || fm.front?.name || fm.front?.title || src.name || skillSlug).trim();
  const version = String(meta?.latest?.version || fm.front?.version || src.version || "1.0.0").trim() || "1.0.0";

  const card = {
    name: displayName,
    slug: safeSlug(src.slug || `openclaw-${owner}-${skillSlug}`),
    version,
    description: String(fm.front?.description || firstParagraph(fm.body) || `Imported from ${webUrl}`).trim(),
    documentation_md: md,
    inputs_schema: { type: "object", properties: {} },
    outputs_schema: { type: "object", properties: {} },
    bindings: [
      { type: "external", url: webUrl },
      {
        type: "openclaw_skill",
        repo: { owner: repoOwner, repo, ref, path: skillPath },
        owner,
        skillSlug,
        metaUrl,
        mdUrl,
        commitUrl: String(meta?.latest?.commit || ""),
      },
    ],
    constraints: {
      riskTier: coerceRiskTier({ constraints: { riskTier: fm.front?.riskTier ?? fm.front?.risk ?? src.riskTier } }, src.riskTier ?? 2),
    },
    required_permissions: Array.isArray(fm.front?.required_permissions)
      ? fm.front.required_permissions
      : Array.isArray(fm.front?.permissions)
        ? fm.front.permissions
        : [],
    examples: [],
    eval_packs: [],
  };

  return { ok: true, mode: "openclaw_skills_repo", skillcard: card, sourceUrl: webUrl, status: metaRes.status || mdRes.status || 0 };
}

function parseClawhubSkillUrlsFromIndexHtml(html, { baseUrl = "https://clawhub.ai", limit = 60 } = {}) {
  const s = String(html || "");
  const out = [];
  const seen = new Set();

  function add(u) {
    const url = String(u || "").trim();
    if (!url) return;
    if (!url.startsWith("http")) return;
    if (!url.includes("clawhub.ai/skills/")) return;
    if (url.includes("?")) return;
    if (url.endsWith("/skills")) return;
    if (seen.has(url)) return;
    seen.add(url);
    out.push(url);
  }

  // Absolute URLs.
  const abs = s.match(/https?:\/\/clawhub\.ai\/skills\/[a-z0-9\-]+/gi) || [];
  for (const u of abs) add(u);

  // Relative hrefs.
  const rel = s.match(/href=\"\/skills\/[a-z0-9\-]+\"/gi) || [];
  for (const h of rel) {
    const m = h.match(/href=\"(\/skills\/[a-z0-9\-]+)\"/i);
    if (!m) continue;
    add(String(baseUrl).replace(/\/+$/, "") + m[1]);
  }

  return out.slice(0, Math.max(1, Number(limit) || 60));
}

function parseClawhubSkillUrlsFromNextData(next, { baseUrl = "https://clawhub.ai", limit = 60, maxNodes = 35000 } = {}) {
  const out = [];
  const seen = new Set();
  const stack = [next];
  let nodes = 0;

  function addPath(p) {
    const pathOnly = String(p || "").trim();
    if (!pathOnly) return;
    if (!pathOnly.startsWith("/skills/")) return;
    const slug = pathOnly.slice("/skills/".length).split(/[/?#]/)[0].trim();
    if (!slug) return;
    const url = String(baseUrl).replace(/\/+$/, "") + "/skills/" + slug;
    if (seen.has(url)) return;
    seen.add(url);
    out.push(url);
  }

  while (stack.length) {
    const cur = stack.pop();
    if (!cur) continue;
    nodes++;
    if (nodes > maxNodes) break;

    if (typeof cur === "string") {
      // Common shapes: "/skills/<slug>" or full URLs.
      if (cur.includes("/skills/")) {
        const m = cur.match(/\/skills\/[a-z0-9\-]+/gi) || [];
        for (const seg of m) addPath(seg);
      }
      continue;
    }

    if (Array.isArray(cur)) {
      for (const v of cur) stack.push(v);
      continue;
    }

    if (typeof cur === "object") {
      // Some payloads include explicit "slug" fields for skills.
      const slug = typeof cur.slug === "string" ? cur.slug.trim() : "";
      if (slug && /^[a-z0-9\-]+$/i.test(slug)) {
        // Heuristic: if object looks like a "skill" record, accept the slug.
        if (("name" in cur) || ("title" in cur) || ("downloads" in cur) || ("author" in cur)) {
          addPath("/skills/" + slug.toLowerCase());
        }
      }
      for (const k of Object.keys(cur)) stack.push(cur[k]);
    }
  }

  return out.slice(0, Math.max(1, Number(limit) || 60));
}

async function importClawhubIndex(src) {
  const indexUrl = String(src.url || src.indexUrl || "").trim();
  if (!indexUrl) return { ok: false, mode: "clawhub_index", error: "missing_url", sourceUrl: "" };

  const { ok, status, text } = await fetchText(indexUrl, { timeoutMs: Number(src.timeoutMs || 20000) || 20000 });
  if (!ok) return { ok: false, mode: "clawhub_index", status, error: "fetch_failed", sourceUrl: indexUrl };

  const limit = Number(src.limit || 60) || 60;
  // ClawHub is Next.js; slugs are often present in __NEXT_DATA__ not as plain <a href>.
  const next = tryExtractNextJsData(text);
  const urls = next
    ? parseClawhubSkillUrlsFromNextData(next, { limit })
    : parseClawhubSkillUrlsFromIndexHtml(text, { limit });
  const riskTier = Number(src.riskTier || 2) || 2;

  const skillcards = [];
  for (const url of urls) {
    const slugFromUrl = String(url.split("/").filter(Boolean).slice(-1)[0] || "").trim();
    const childSrc = {
      source: "clawhub",
      name: `ClawHub: ${slugFromUrl || "skill"}`,
      slug: safeSlug((src.slugPrefix ? `${src.slugPrefix}-` : "clawhub-") + (slugFromUrl || "skill")),
      url,
      riskTier,
    };

    try {
      const one = await importOneSource(childSrc);
      const sourceUrl = one.sourceUrl || url;
      const cardIn = one.skillcard || null;
      const normalized = cardIn
        ? normalizeImportedSkillcard(cardIn, childSrc, { sourceUrl })
        : normalizeImportedSkillcard(buildStubSkillcard(childSrc, { url }), childSrc, { sourceUrl });
      skillcards.push(normalized);
    } catch (e) {
      const sourceUrl = url;
      const normalized = normalizeImportedSkillcard(buildStubSkillcard(childSrc, { url }), childSrc, { sourceUrl });
      skillcards.push(normalized);
    }
  }

  return { ok: true, mode: "clawhub_index", status, sourceUrl: indexUrl, skillcards, meta: { found: urls.length, limit } };
}

async function importOneSource(src) {
  if (src && (src.source === "clawhub_index" || src.source === "clawhub_index_page")) {
    return importClawhubIndex(src);
  }
  if (src && (src.source === "openclaw_skills" || src.source === "openclaw_skills_repo")) {
    return importOpenClawSkillsRepo(src);
  }

  // Local file import (useful for testing and for bootstrapping from seed cards).
  if ((src && src.source === "local") || src.filePath || src.file) {
    const rel = String(src.filePath || src.file || src.path || "").trim();
    if (!rel) return { ok: false, mode: "local", error: "missing_path", sourceUrl: "" };
    try {
      const p = path.resolve(process.cwd(), rel);
      const raw = fs.readFileSync(p, "utf8");
      const j = JSON.parse(raw);
      return { ok: true, mode: "local", skillcard: j, sourceUrl: `file://${p}` };
    } catch (e) {
      return { ok: false, mode: "local", error: "read_failed", sourceUrl: rel };
    }
  }

  const githubUrl = makeGithubRawUrl(src);
  const primaryUrl = String(src.skillcardUrl || src.jsonUrl || githubUrl || src.url || "").trim();
  if (!primaryUrl) {
    return { ok: false, mode: "error", error: "missing_url", sourceUrl: "" };
  }

  // Fast path: URL is JSON.
  if (isProbablyJsonUrl(primaryUrl)) {
    const { ok, status, text } = await fetchText(primaryUrl);
    if (!ok) {
      return { ok: false, mode: "fetch_json", status, error: "fetch_failed", sourceUrl: primaryUrl };
    }
    try {
      const j = JSON.parse(text);
      const extracted = src && src.extractPath ? getByPath(j, src.extractPath) : undefined;
      const candidate = extracted !== undefined ? extracted : j;
      if (looksLikeSkillcard(candidate)) {
        return { ok: true, mode: "json", skillcard: candidate, sourceUrl: primaryUrl };
      }
      return { ok: true, mode: "json_non_skillcard", skillcard: j, sourceUrl: primaryUrl };
    } catch (e) {
      return { ok: false, mode: "fetch_json", status, error: "invalid_json", sourceUrl: primaryUrl };
    }
  }

  // ClawHub / generic HTML: attempt Next.js extraction (best-effort).
  const { ok, status, text } = await fetchText(primaryUrl);
  if (!ok) {
    return { ok: false, mode: "fetch_html", status, error: "fetch_failed", sourceUrl: primaryUrl };
  }
  const next = tryExtractNextJsData(text);
  if (!next) {
    return { ok: true, mode: "stub", skillcard: buildStubSkillcard(src, { url: primaryUrl }), sourceUrl: primaryUrl };
  }
  const extracted = src && src.extractPath ? getByPath(next, src.extractPath) : undefined;
  const candidate = extracted !== undefined ? extracted : findFirstSkillcardLike(next);
  if (!candidate) {
    return { ok: true, mode: "stub", skillcard: buildStubSkillcard(src, { url: primaryUrl }), sourceUrl: primaryUrl };
  }
  return { ok: true, mode: "next_data", skillcard: candidate, sourceUrl: primaryUrl };
}

async function publishImportedSkillcards({
  rpc,
  privateKey,
  skillNft,
  registry,
  items,
  uriBase,
  parentId,
}) {
  if (!rpc || !privateKey || !skillNft || !registry) {
    throw new Error("publish requires --rpc --privateKey --skillNft --registry");
  }
  const account = privateKeyToAccount(privateKey);
  const transport = http(rpc);
  const publicClient = createPublicClient({ transport });
  const walletClient = createWalletClient({ transport, account });

  const skillNftContract = { address: skillNft, abi: SkillNFT_ABI };
  const registryContract = { address: registry, abi: SkillRegistry_ABI };

  const published = [];
  for (const it of items) {
    const sc = it.skillcard;
    const versionHash = computeSkillVersionHash(sc.version);
    const contentHash = computeSkillcardContentHash(sc);
    const riskTier = coerceRiskTier(sc, 2);
    const uri =
      uriBase
        ? String(uriBase).replace(/\/+$/, "") + "/" + `${sc.slug}.v${safeVersionForFile(sc.version)}.json`
        : String(it.sourceUrl || it.fileUri || it.file || "");

    const mintHash = await walletClient.writeContract({
      ...skillNftContract,
      functionName: "mintSkill",
      args: [BigInt(parentId || 0)],
    });
    await publicClient.waitForTransactionReceipt({ hash: mintHash });
    const nextId = await publicClient.readContract({
      ...skillNftContract,
      functionName: "nextSkillId",
      args: [],
    });
    const skillId = BigInt(nextId) - 1n;

    const pubHash = await walletClient.writeContract({
      ...registryContract,
      functionName: "publishVersion",
      args: [skillId, versionHash, contentHash, uri, riskTier],
    });
    await publicClient.waitForTransactionReceipt({ hash: pubHash });

    published.push({
      slug: sc.slug,
      skillId: String(skillId),
      versionHash,
      contentHash,
      uri,
      riskTier,
      txs: { mint: mintHash, publish: pubHash },
    });
  }
  return published;
}

function shortSha(s) {
  const v = String(s || "").trim();
  if (!v) return "";
  return v.length <= 10 ? v : v.slice(0, 10);
}

function convertSkillMdToSkillcard(md, src, { webUrl = "", rawUrl = "" } = {}) {
  const text = String(md || "");
  const lines = text.split(/\r?\n/);
  let title = "";
  for (const ln of lines) {
    const m = ln.match(/^\s*#\s+(.+)\s*$/);
    if (m) { title = String(m[1] || "").trim(); break; }
  }
  const desc = firstParagraph(text);
  // Prefer the SKILL.md title for a clean UX name; src.name is often a source label.
  const name = String(title || src.skillName || src.slug || src.name || "Imported Skill").trim();
  const slug = safeSlug(src.slug || name);
  const version = String(src.version || "1.0.0").trim() || "1.0.0";
  const riskTier = Number(src.riskTier || 2);
  return {
    name,
    slug,
    version,
    description: String(src.description || desc || `Imported from ${webUrl || rawUrl || "GitHub"}`).trim(),
    documentation_md: text,
    inputs_schema: { type: "object", properties: {} },
    outputs_schema: { type: "object", properties: {} },
    bindings: [
      ...(webUrl ? [{ type: "external", url: webUrl }] : []),
      ...(rawUrl ? [{ type: "external", url: rawUrl }] : []),
      {
        type: "openclaw_skill_md",
        // Informational binding for provenance; execution is outside ApeClaw v2-alpha.
        source: "github",
        path: String(src.path || ""),
      },
    ],
    constraints: { riskTier, importedStub: false },
    required_permissions: [],
    examples: [],
    eval_packs: [],
    provenance: {
      publisher: "apeclaw-importer",
      signed: false,
      source: "github",
      sourceUrl: String(webUrl || rawUrl || "").trim(),
      importedAt: new Date().toISOString(),
    },
  };
}

async function importGithubRepoSkillMarkdown(src) {
  const owner = String(src.owner || "").trim();
  const repo = String(src.repo || "").trim();
  const ref = String(src.ref || "main").trim();
  const basePath = String(src.basePath || "").trim().replace(/^\/+|\/+$/g, "");
  const limit = Math.max(1, Math.min(500, Number(src.limit || 100)));
  const offset = Math.max(0, Math.floor(Number(src.offset || 0) || 0));
  if (!owner || !repo) {
    return { ok: false, mode: "github_repo_skill_md", error: "missing_owner_or_repo", sourceUrl: "" };
  }

  // GitHub rate limit is low without auth; allow optional token.
  const token = String(process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "").trim();
  const ghHeaders = token
    ? { "user-agent": "apeclaw-skillcard-importer/1.0", authorization: `Bearer ${token}` }
    : { "user-agent": "apeclaw-skillcard-importer/1.0" };

  async function ghFetchJson(url) {
    const res = await fetch(url, { headers: ghHeaders });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { ok: res.ok, status: res.status, json, text };
  }

  // Use the git tree API so we can find SKILL.md files in one request.
  const refRes = await ghFetchJson(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs/heads/${encodeURIComponent(ref)}`);
  if (!refRes.ok) {
    return { ok: false, mode: "github_repo_skill_md", status: refRes.status, error: "ref_fetch_failed", sourceUrl: `https://github.com/${owner}/${repo}` };
  }
  const commitSha = refRes.json?.object?.sha;
  if (!commitSha) {
    return { ok: false, mode: "github_repo_skill_md", status: refRes.status, error: "missing_commit_sha", sourceUrl: `https://github.com/${owner}/${repo}` };
  }
  const commitRes = await ghFetchJson(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits/${encodeURIComponent(commitSha)}`);
  const treeSha = commitRes.ok ? commitRes.json?.tree?.sha : null;
  if (!treeSha) {
    return { ok: false, mode: "github_repo_skill_md", status: commitRes.status, error: "tree_fetch_failed", sourceUrl: `https://github.com/${owner}/${repo}` };
  }

  const treeRes = await ghFetchJson(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(treeSha)}?recursive=1`);
  if (!treeRes.ok) {
    return { ok: false, mode: "github_repo_skill_md", status: treeRes.status, error: "tree_list_failed", sourceUrl: `https://github.com/${owner}/${repo}` };
  }
  const entries = Array.isArray(treeRes.json?.tree) ? treeRes.json.tree : [];
  const mdPaths = entries
    .filter((e) => e && e.type === "blob" && typeof e.path === "string" && /(^|\/)SKILL\.md$/i.test(e.path))
    .map((e) => String(e.path));

  const inBase = basePath
    ? mdPaths.filter((p) => p === basePath || p.startsWith(basePath + "/"))
    : mdPaths;
  const selected = inBase.slice(offset, offset + limit);

  const skillcards = [];
  for (const p of selected) {
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${p}`;
    const webUrl = `https://github.com/${owner}/${repo}/blob/${ref}/${p}`;
    const mdRes = await fetchText(rawUrl);
    if (!mdRes.ok) continue;
    const parts = p.split("/").filter(Boolean);
    const leaf = parts.length ? parts[parts.length - 2] || parts[parts.length - 1] : p;
    const prefix = safeSlug(src.slugPrefix || src.slug || `${owner}-${repo}`);
    const slug = safeSlug(`${prefix}-${leaf}`);
    const card = convertSkillMdToSkillcard(mdRes.text, {
      ...src,
      slug,
      // Keep per-skill name clean; source labels belong in provenance.
      skillName: leaf,
      path: p,
      version: src.version || "1.0.0",
      description: src.description || "",
      riskTier: src.riskTier || 2,
    }, { webUrl, rawUrl });
    // Carry commit info for provenance/debugging (best-effort).
    if (card.bindings && card.bindings[2] && typeof card.bindings[2] === "object") {
      card.bindings[2].repo = { owner, repo, ref, path: p, commit: shortSha(commitSha) };
    }
    skillcards.push(card);
  }

  return {
    ok: true,
    mode: "github_repo_skill_md",
    status: treeRes.status || 200,
    sourceUrl: `https://github.com/${owner}/${repo}/tree/${ref}/${basePath}`,
    skillcards,
    meta: { owner, repo, ref, basePath, commitSha, found: mdPaths.length, offset, limit, selected: selected.length },
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const manifestPath = path.resolve(process.cwd(), args.manifest || path.join("skillcards", "import-sources.json"));
  const outDir = path.resolve(process.cwd(), args.outDir || path.join("skillcards", "imported"));
  const indexPath = path.resolve(process.cwd(), args.index || args.writeIndex || path.join(outDir, "index.json"));
  ensureDir(outDir);

  const manifest = readJson(manifestPath);
  const sources = Array.isArray(manifest.sources) ? manifest.sources : [];
  if (sources.length === 0) {
    console.error(`No sources in ${manifestPath}`);
    process.exit(2);
  }

  const results = [];
  const written = [];
  const quarantined = [];

  for (const src of sources) {
    try {
      let imported;
      if (src && src.source === "github_repo_skill_md") {
        imported = await importGithubRepoSkillMarkdown(src);
      } else {
        imported = await importOneSource(src);
      }

      const fallbackUrl = imported.sourceUrl || makeGithubRawUrl(src) || String(src.url || "").trim();
      const sourceUrl = fallbackUrl;

      const cards = Array.isArray(imported.skillcards) ? imported.skillcards : (imported.skillcard ? [imported.skillcard] : []);
      if (cards.length === 0) {
        // If fetch/extraction failed, write a stub SkillCard that preserves provenance.
        const importOk = !!imported.ok;
        const mode = importOk ? imported.mode : "stub_fallback";
        const inputSkillcard = importOk ? imported.skillcard : buildStubSkillcard(src, { url: sourceUrl });

        // Strict mode: do not accept stubs or non-skillcard payloads.
        if (args.strict) {
          const cand = importOk ? imported.skillcard : null;
          const isStub =
            mode === "stub" ||
            mode === "stub_fallback" ||
            (cand && cand.constraints && cand.constraints.importedStub === true);
          const isSkill = looksLikeSkillcard(cand);
          if (!isSkill || isStub) {
            results.push({
              ok: false,
              strict: true,
              importOk,
              mode,
              status: imported.status || 0,
              importError: String(imported.error || "skillcard_payload_not_found"),
              source: src.source || "unknown",
              name: String(src.name || ""),
              slug: safeSlug(src.slug || src.name || ""),
              sourceUrl,
            });
            continue;
          }
        }

        const normalized = normalizeImportedSkillcard(inputSkillcard, src, { sourceUrl });
        const fileName = `${normalized.slug}.v${safeVersionForFile(normalized.version)}.json`;
        const file = path.join(outDir, fileName);
        fs.writeFileSync(file, JSON.stringify(normalized, null, 2));
        const parsed = readSkillcardJson(file);
        const versionHash = computeSkillVersionHash(parsed.version);
        const contentHash = computeSkillcardContentHash(parsed);
        const vet = assessSkillcardSafety(parsed);
        const rec = {
          ok: true,
          importOk,
          mode,
          status: imported.status || 0,
          importError: importOk ? "" : String(imported.error || "import_failed"),
          source: src.source || "unknown",
          name: parsed.name,
          slug: parsed.slug,
          version: parsed.version,
          riskTier: Number((parsed.constraints || {}).riskTier || 0),
          file,
          fileName,
          sourceUrl: String(parsed?.provenance?.sourceUrl || sourceUrl || ""),
          hashes: { versionHash, contentHash },
          vetted: vet,
          vettedOk: Boolean(vet && vet.ok),
        };
        results.push(rec);
        written.push({ ...rec, skillcard: parsed, fileUri: `file://${file}` });
        if (!rec.vettedOk) quarantined.push(rec);
        continue;
      }

      // Multi-skill imports (e.g. github_repo_skill_md).
      for (let idx = 0; idx < cards.length; idx++) {
        const cardIn = cards[idx];
        const normalized = normalizeImportedSkillcard(cardIn, src, { sourceUrl });
        const fileName = `${normalized.slug}.v${safeVersionForFile(normalized.version)}.json`;
        const file = path.join(outDir, fileName);
        fs.writeFileSync(file, JSON.stringify(normalized, null, 2));
        const parsed = readSkillcardJson(file);
        const versionHash = computeSkillVersionHash(parsed.version);
        const contentHash = computeSkillcardContentHash(parsed);
        const vet = assessSkillcardSafety(parsed);
        const rec = {
          ok: true,
          importOk: !!imported.ok,
          mode: imported.mode || "multi",
          status: imported.status || 0,
          importError: "",
          source: src.source || "unknown",
          name: parsed.name,
          slug: parsed.slug,
          version: parsed.version,
          riskTier: Number((parsed.constraints || {}).riskTier || 0),
          file,
          fileName,
          sourceUrl: String(parsed?.provenance?.sourceUrl || sourceUrl || ""),
          hashes: { versionHash, contentHash },
          vetted: vet,
          vettedOk: Boolean(vet && vet.ok),
        };
        results.push(rec);
        written.push({ ...rec, skillcard: parsed, fileUri: `file://${file}` });
        if (!rec.vettedOk) quarantined.push(rec);
      }
    } catch (e) {
      results.push({
        ok: false,
        source: src.source || "unknown",
        slug: safeSlug(src.slug || src.name || ""),
        error: String(e && e.message ? e.message : e),
      });
    }
  }

  let published = [];
  if (args.publish) {
    const okItems = written.filter((w) => w && w.ok);
    let filtered = args.skipStubs
      ? okItems.filter((w) => !(w.skillcard && w.skillcard.constraints && w.skillcard.constraints.importedStub === true))
      : okItems;
    // Safety default: only publish items that passed local vetting.
    if (!args.allowUnvetted && !args.allow_unvetted) {
      filtered = filtered.filter((w) => Boolean(w.vettedOk));
    }
    const publishSlugPrefix = String(args.publishSlugPrefix || args.publish_slug_prefix || "").trim();
    if (publishSlugPrefix) {
      filtered = filtered.filter((w) => String(w?.skillcard?.slug || w?.slug || "").startsWith(publishSlugPrefix));
    }
    const publishLimitRaw = args.publishLimit || args.publish_limit || args.limitPublish || args.limit_publish || 0;
    const publishLimit = Number(publishLimitRaw || 0);
    if (Number.isFinite(publishLimit) && publishLimit > 0) {
      filtered = filtered.slice(0, Math.floor(publishLimit));
    }
    published = await publishImportedSkillcards({
      rpc: args.rpc,
      privateKey: args.privateKey,
      skillNft: args.skillNft,
      registry: args.registry,
      uriBase: args.uriBase || args.uri_base || "",
      parentId: args.parentId || args.parent_id || 0,
      items: filtered.map((w) => ({
        skillcard: w.skillcard,
        sourceUrl: w.sourceUrl,
        file: w.file,
        fileUri: w.fileUri,
      })),
    });
  }

  // Write an index file so downstream tooling can map imported skillcards -> onchain IDs.
  try {
    fs.writeFileSync(
      indexPath,
      JSON.stringify(
        {
          ok: true,
          generatedAt: new Date().toISOString(),
          manifest: manifestPath,
          outDir,
          imported: results,
          quarantined,
          published,
        },
        null,
        2,
      ),
    );
  } catch (e) {
    // Non-fatal.
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        manifest: manifestPath,
        outDir,
        index: indexPath,
        imported: results,
        quarantined,
        published,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

