/**
 * Routes:
 *   GET  /api/openclaw/env
 *   POST /api/openclaw/env
 *
 * Local-only helper for Forge to read/update OpenClaw env keys.
 */

import fs from "node:fs";
import path from "node:path";
import { collectBody } from "../middleware/body-limit.mjs";
import { openClawEnvFileCandidates } from "../../lib/openclaw-paths.mjs";

const ALLOWED_KEYS = [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "PERPLEXITY_API_KEY",
  "GROQ_API_KEY",
  "TOGETHER_API_KEY",
  "OLLAMA_HOST",
  "OLLAMA_BASE_URL",
];
const BLOCKED_KEYS = new Set([
  "PATH", "HOME", "SHELL", "PWD", "USER", "LOGNAME",
  "OPENCLAW_HOME", "OPENCLAW_STATE_DIR", "OPENCLAW_CONFIG_PATH",
  "FORGE_LLM_API_URL", "FORGE_LLM_API_KEY", "FORGE_LLM_MODEL",
]);

function isLocalRequest(req) {
  const ip = String(req.socket?.remoteAddress || "");
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

function resolveEnvPath() {
  const candidates = openClawEnvFileCandidates();
  return candidates.find((p) => fs.existsSync(p)) || candidates[0];
}

function parseEnv(raw) {
  const out = {};
  for (const line of String(raw || "").split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const eq = s.indexOf("=");
    if (eq <= 0) continue;
    const key = s.slice(0, eq).trim();
    let val = s.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key) out[key] = val;
  }
  return out;
}

function quoteEnvValue(value) {
  const s = String(value ?? "");
  if (!s) return '""';
  if (/[\s#"'`\\]/.test(s)) {
    return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return s;
}

function isValidEnvKey(key) {
  const k = String(key || "").trim();
  if (!k) return false;
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) return false;
  if (BLOCKED_KEYS.has(k)) return false;
  return true;
}

function renderEnv(map, managedKeys, previousRaw = "") {
  const oldLines = String(previousRaw || "").split(/\r?\n/);
  const seen = new Set();
  const nextLines = oldLines.map((line) => {
    const eq = line.indexOf("=");
    if (eq <= 0) return line;
    const key = line.slice(0, eq).trim();
    if (!managedKeys.has(key)) return line;
    seen.add(key);
    if (!(key in map)) return line;
    const val = String(map[key] ?? "");
    if (!val) return `# ${key}=`;
    return `${key}=${quoteEnvValue(val)}`;
  });

  for (const key of managedKeys) {
    if (seen.has(key)) continue;
    const val = String(map[key] ?? "");
    if (!val) continue;
    nextLines.push(`${key}=${quoteEnvValue(val)}`);
  }
  return `${nextLines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

function buildMasked(map) {
  const masked = {};
  for (const key of Object.keys(map || {})) {
    const v = String(map[key] || "");
    if (!v) masked[key] = "";
    else if (key.endsWith("_HOST") || key.endsWith("_URL") || key.endsWith("_MODEL")) masked[key] = v;
    else if (/KEY|TOKEN|SECRET|PASSWORD/i.test(key)) masked[key] = v.length <= 8 ? "*".repeat(v.length) : `${v.slice(0, 4)}...${v.slice(-4)}`;
    else if (v.length <= 8) masked[key] = "*".repeat(v.length);
    else masked[key] = `${v.slice(0, 4)}...${v.slice(-4)}`;
  }
  return masked;
}

export function handleOpenClawEnvGet(req, res) {
  if (!isLocalRequest(req)) {
    res.writeHead(403, { "content-type": "application/json" });
    return res.end(JSON.stringify({ ok: false, error: "local requests only" }));
  }
  const envPath = resolveEnvPath();
  const raw = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const parsed = parseEnv(raw);
  const values = {};
  for (const key of ALLOWED_KEYS) values[key] = String(parsed[key] || "");
  const customValues = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (ALLOWED_KEYS.includes(k)) continue;
    if (!isValidEnvKey(k)) continue;
    customValues[k] = String(v || "");
  }
  const masked = buildMasked({ ...values, ...customValues });
  res.writeHead(200, { "content-type": "application/json" });
  return res.end(JSON.stringify({
    ok: true,
    envPath,
    keys: ALLOWED_KEYS,
    values,
    customValues,
    masked,
  }));
}

export async function handleOpenClawEnvSet(req, res) {
  if (!isLocalRequest(req)) {
    res.writeHead(403, { "content-type": "application/json" });
    return res.end(JSON.stringify({ ok: false, error: "local requests only" }));
  }
  const rawBody = await collectBody(req, res);
  if (rawBody === null) return;
  let body;
  try { body = JSON.parse(rawBody); } catch {
    res.writeHead(400, { "content-type": "application/json" });
    return res.end(JSON.stringify({ ok: false, error: "invalid JSON body" }));
  }
  const updates = body?.updates && typeof body.updates === "object" ? body.updates : null;
  if (!updates) {
    res.writeHead(400, { "content-type": "application/json" });
    return res.end(JSON.stringify({ ok: false, error: "updates object required" }));
  }

  const warnings = [];
  for (const [k, v] of Object.entries(updates)) {
    const val = String(v ?? "").trim();
    if (!val) continue;
    if (k === "OPENAI_API_KEY" && !val.startsWith("sk-")) {
      warnings.push(`${k} should start with "sk-". The value you provided doesn't look like a valid OpenAI API key.`);
    }
    if (k === "ANTHROPIC_API_KEY" && !val.startsWith("sk-ant-")) {
      warnings.push(`${k} should start with "sk-ant-". The value you provided doesn't look like a valid Anthropic key.`);
    }
    if (k === "GROQ_API_KEY" && !val.startsWith("gsk_")) {
      warnings.push(`${k} should start with "gsk_". The value you provided doesn't look like a valid Groq key.`);
    }
    if (k === "PERPLEXITY_API_KEY" && !val.startsWith("pplx-")) {
      warnings.push(`${k} should start with "pplx-". The value you provided doesn't look like a valid Perplexity key.`);
    }
    if (/API_KEY$/i.test(k) && val.length < 20) {
      warnings.push(`${k} looks too short to be a real API key (${val.length} chars).`);
    }
  }
  if (warnings.length) {
    res.writeHead(400, { "content-type": "application/json" });
    return res.end(JSON.stringify({ ok: false, error: "Invalid API key format", warnings }));
  }

  const envPath = resolveEnvPath();
  const currentRaw = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const current = parseEnv(currentRaw);
  const next = { ...current };
  const applied = {};
  const managedKeys = new Set(ALLOWED_KEYS);
  for (const [k, v] of Object.entries(updates)) {
    if (!isValidEnvKey(k)) continue;
    next[k] = String(v ?? "").trim();
    applied[k] = next[k];
    managedKeys.add(k);
  }
  const rendered = renderEnv(next, managedKeys, currentRaw);
  fs.mkdirSync(path.dirname(envPath), { recursive: true });
  fs.writeFileSync(envPath, rendered, { mode: 0o600 });

  res.writeHead(200, { "content-type": "application/json" });
  return res.end(JSON.stringify({
    ok: true,
    envPath,
    applied,
    masked: buildMasked(applied),
    note: "Saved. Forge provider detection refreshes automatically on next requests.",
  }));
}

