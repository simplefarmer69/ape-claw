/**
 * Routes: POST /api/forge/chat
 *
 * Real OpenClaw agent wrapper for the Forge page.
 * - Loads skills from ~/.openclaw/skills/ at startup
 * - Registered ClawBot identity (FORGE_AGENT_ID / FORGE_AGENT_TOKEN)
 * - Fetches live telemetry snapshot on each request
 * - Streams responses via Perplexity Sonar API
 * - Posts conversations to chat log + emits telemetry events
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { getStorage } from "../storage/index.mjs";
import { collectBody } from "../middleware/body-limit.mjs";
import { CLAWBOTS_PATH } from "../../lib/paths.mjs";
import { registerClawbot, verifyClawbot } from "../../lib/clawbots.mjs";
import logger from "../logger.mjs";

const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";
const PERPLEXITY_MODEL = String(process.env.FORGE_AGENT_MODEL || "sonar-pro").trim();
const SKILL_RESCAN_INTERVAL_MS = 5 * 60 * 1000;
const MAX_HISTORY_TURNS = 10;
const MAX_MESSAGE_LENGTH = 500;

const FORGE_AGENT_ID = String(process.env.FORGE_AGENT_ID || "the-clawllector").trim();
const FORGE_AGENT_TOKEN = String(process.env.FORGE_AGENT_TOKEN || "").trim();
const PERPLEXITY_API_KEY = String(process.env.PERPLEXITY_API_KEY || "").trim();
const FORGE_AGENT_DISPLAY_NAME = String(process.env.FORGE_AGENT_NAME || "The Clawllector").trim();

// IP rate limiting for unauthenticated visitors
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const rateBuckets = new Map();

let cachedSkills = { apeClawFull: "", summaries: [], loadedAt: 0 };
let runtimeAgentToken = FORGE_AGENT_TOKEN;
let runtimeAgentVerified = false;

/* ══════════════════════════════════════════════════════════
   Skill Loader — reads from ~/.openclaw/skills/ and fallback
   ══════════════════════════════════════════════════════════ */

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\s*/);
  if (!match) return { meta: {}, body: content };
  const meta = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      meta[key] = val;
    }
  }
  return { meta, body: content.slice(match[0].length) };
}

function loadSkillsFromDir(dir) {
  const skills = [];
  if (!fs.existsSync(dir)) return skills;
  let entries;
  try { entries = fs.readdirSync(dir); } catch { return skills; }
  for (const name of entries) {
    const skillMd = path.join(dir, name, "SKILL.md");
    if (!fs.existsSync(skillMd)) continue;
    try {
      const raw = fs.readFileSync(skillMd, "utf8");
      const { meta, body } = parseFrontmatter(raw);
      skills.push({
        slug: name,
        name: meta.name || name,
        description: meta.description || "",
        version: meta.version || "",
        fullContent: raw,
        body,
      });
    } catch {}
  }
  return skills;
}

function findOpenClawBundledSkillsDir() {
  try {
    const bin = execSync("which openclaw", { encoding: "utf8" }).trim();
    if (bin) {
      const resolved = fs.realpathSync(bin);
      const pkgDir = path.resolve(path.dirname(resolved), "..", "lib", "node_modules", "openclaw", "skills");
      if (fs.existsSync(pkgDir)) return pkgDir;
      const altDir = path.resolve(path.dirname(resolved), "..", "node_modules", "openclaw", "skills");
      if (fs.existsSync(altDir)) return altDir;
    }
  } catch {}
  const globalPaths = [
    "/usr/local/lib/node_modules/openclaw/skills",
    "/usr/lib/node_modules/openclaw/skills",
    path.join(os.homedir(), ".npm-global", "lib", "node_modules", "openclaw", "skills"),
  ];
  for (const p of globalPaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

let _openclawBundledDir = undefined;

function refreshSkillCache() {
  const now = Date.now();
  if (now - cachedSkills.loadedAt < SKILL_RESCAN_INTERVAL_MS) return;

  const seen = new Set();
  const allSkills = [];

  function addSkillsFrom(dir) {
    for (const s of loadSkillsFromDir(dir)) {
      if (!seen.has(s.slug)) {
        seen.add(s.slug);
        allSkills.push(s);
      }
    }
  }

  addSkillsFrom(path.join(os.homedir(), ".openclaw", "skills"));

  if (_openclawBundledDir === undefined) {
    _openclawBundledDir = findOpenClawBundledSkillsDir();
    if (_openclawBundledDir) logger.info({ dir: _openclawBundledDir }, "Found OpenClaw bundled skills");
  }
  if (_openclawBundledDir) addSkillsFrom(_openclawBundledDir);

  addSkillsFrom(path.join(process.cwd(), "data", "forge-skills"));

  addSkillsFrom(path.join(process.cwd(), ".cursor", "skills"));

  const skills = allSkills;

  const apeClaw = skills.find((s) => s.slug === "ape-claw");
  const summaries = skills
    .filter((s) => s.slug !== "ape-claw")
    .map((s) => `- **${s.name}**: ${s.description || "(no description)"}`)
    .slice(0, 80);

  cachedSkills = {
    apeClawFull: apeClaw?.fullContent || "",
    summaries,
    loadedAt: now,
  };

  logger.info({ skillCount: skills.length, source: skills.length > 0 ? "openclaw" : "fallback" }, "Forge agent skills loaded");
}

function ensureForgeAgentIdentity() {
  if (runtimeAgentToken) {
    const check = verifyClawbot({ agentId: FORGE_AGENT_ID, agentToken: runtimeAgentToken });
    if (check.verified) {
      runtimeAgentVerified = true;
      return;
    }
    logger.warn({ reason: check.reason }, "FORGE_AGENT_TOKEN provided but verification failed");
  }

  // Auto-register fallback for first startup if token not pre-provisioned.
  try {
    const reg = registerClawbot({ agentId: FORGE_AGENT_ID, displayName: FORGE_AGENT_DISPLAY_NAME });
    runtimeAgentToken = reg.token;
    runtimeAgentVerified = true;
    logger.info({ agentId: reg.agentId }, "Forge agent auto-registered as clawbot");
  } catch (err) {
    runtimeAgentVerified = false;
    logger.warn(
      { err: err?.message || String(err) },
      "Forge agent auto-registration unavailable; set FORGE_AGENT_TOKEN for verified identity",
    );
  }
}

/* ══════════════════════════════════════════════════════════
   Telemetry Snapshot — direct storage access
   ══════════════════════════════════════════════════════════ */

function getTelemetrySnapshot() {
  const store = getStorage();
  const snapshot = {};

  try {
    const events = store.getEventBacklog(15);
    snapshot.recentEvents = events.slice(-15).map((e) => {
      const ts = e.ts ? new Date(e.ts).toLocaleString() : "?";
      return `[${ts}] ${e.eventType} by ${e.agentId || "unknown"}${e.command ? ` (${e.command})` : ""}${e.ok === false ? " FAILED" : ""}`;
    });
  } catch { snapshot.recentEvents = []; }

  try {
    const chatEntries = store.readChatEntries();
    const messages = chatEntries
      .filter((e) => e.type === "message")
      .slice(-10);
    snapshot.recentChat = messages.map((m) => `[${m.agentName || m.agentId || "?"}] ${(m.text || "").slice(0, 120)}`);
  } catch { snapshot.recentChat = []; }

  try {
    if (fs.existsSync(CLAWBOTS_PATH)) {
      const raw = JSON.parse(fs.readFileSync(CLAWBOTS_PATH, "utf8"));
      const agents = raw.agents || {};
      const bots = Object.entries(agents).map(([id, a]) => ({
        id, name: a.name || id, enabled: a.enabled !== false,
      }));
      snapshot.clawbots = bots;
    } else {
      snapshot.clawbots = [];
    }
  } catch { snapshot.clawbots = []; }

  try {
    const all = store.getMergedSkillIndex();
    const onchain = all.filter((s) => s.onchainTokenId != null).length;
    const seed = all.filter((s) => s.source === "seed").length;
    const imported = all.filter((s) => s.source === "imported").length;
    const user = all.filter((s) => s.source === "user").length;
    snapshot.skillStats = { total: all.length, seed, imported, user, onchain };
  } catch { snapshot.skillStats = { total: 0 }; }

  try {
    const userIdx = store.getUserSkillsIndex();
    const userSkills = Array.isArray(userIdx?.skills) ? userIdx.skills : [];
    snapshot.userInstalledSkills = userSkills.length;
  } catch { snapshot.userInstalledSkills = 0; }

  try { snapshot.quoteSpend = store.getQuotesSpendToday(); } catch { snapshot.quoteSpend = 0; }
  try { snapshot.bridgeSpend = store.getBridgeSpendToday(); } catch { snapshot.bridgeSpend = 0; }

  try {
    const podWs = store.findPodWorkspaceDir();
    if (podWs) {
      const stopped = fs.existsSync(path.join(podWs, "stop.flag"));
      const hasAgents = fs.existsSync(path.join(podWs, "AGENTS.md"));
      let lastHeartbeat = null;
      const hbPath = path.join(podWs, "state", "last-heartbeat.json");
      if (fs.existsSync(hbPath)) {
        try { lastHeartbeat = JSON.parse(fs.readFileSync(hbPath, "utf8"))?.timestamp || null; } catch {}
      }
      snapshot.pod = { status: hasAgents ? (stopped ? "stopped" : "running") : "not-initialized", lastHeartbeat };
    } else {
      snapshot.pod = { status: "not-initialized" };
    }
  } catch { snapshot.pod = { status: "unknown" }; }

  return snapshot;
}

function formatTelemetryContext(snapshot) {
  const lines = ["## Live Telemetry (real-time data from the backend)"];

  const bots = snapshot.clawbots || [];
  const activeNames = bots.filter((b) => b.enabled).map((b) => b.name).slice(0, 20);
  lines.push(`- Registered clawbots: ${bots.length} total${activeNames.length ? ` (${activeNames.join(", ")})` : ""}`);

  const ss = snapshot.skillStats || {};
  lines.push(`- Skills library: ${ss.total || 0} total (${ss.seed || 0} seed, ${ss.imported || 0} imported, ${ss.user || 0} user), ${ss.onchain || 0} onchain`);
  lines.push(`- User-installed skill records: ${snapshot.userInstalledSkills || 0}`);

  lines.push(`- Daily spend: NFT quotes ${snapshot.quoteSpend || 0} APE / Bridge ${snapshot.bridgeSpend || 0} APE`);
  lines.push(`- Pod status: ${snapshot.pod?.status || "unknown"}${snapshot.pod?.lastHeartbeat ? `, last heartbeat ${snapshot.pod.lastHeartbeat}` : ""}`);

  if (snapshot.recentEvents?.length) {
    lines.push("", "### Recent telemetry events");
    for (const e of snapshot.recentEvents.slice(-10)) lines.push(`  ${e}`);
  }

  if (snapshot.recentChat?.length) {
    lines.push("", "### Recent forge chat");
    for (const m of snapshot.recentChat.slice(-5)) lines.push(`  ${m}`);
  }

  return lines.join("\n");
}

/* ══════════════════════════════════════════════════════════
   System Prompt Builder
   ══════════════════════════════════════════════════════════ */

function buildSystemPrompt(snapshot) {
  refreshSkillCache();

  const parts = [
    `You are The Clawllector, a real OpenClaw agent running on apeclaw.ai with the ape-claw skill set installed. You are a registered ClawBot (agentId: ${FORGE_AGENT_ID}) powered by Perplexity Sonar.`,
    "",
    "## Identity",
    `- Registered ClawBot: ${FORGE_AGENT_ID}`,
    "- Framework: OpenClaw (openclaw.ai) — a personal AI assistant framework that runs on your machine",
    "- LLM brain: Perplexity Sonar (web-grounded)",
    `- Skills installed: ${cachedSkills.summaries.length + (cachedSkills.apeClawFull ? 1 : 0)}`,
    "",
  ];

  if (cachedSkills.apeClawFull) {
    parts.push("## Ape-Claw Skill Knowledge (your primary skill)");
    parts.push(cachedSkills.apeClawFull);
    parts.push("");
  }

  parts.push(formatTelemetryContext(snapshot));

  if (cachedSkills.summaries.length) {
    parts.push("", "## Other Installed Skills");
    parts.push(...cachedSkills.summaries);
  }

  parts.push("", "## Behavior");
  parts.push("- You have REAL access to live backend data — cite it when users ask about activity, bots, skills, or spend.");
  parts.push("- Guide users through getting started with ApeClaw and OpenClaw.");
  parts.push("- Reference specific CLI commands from the ape-claw skill (e.g. `npx ape-claw skill install`, `npx ape-claw doctor --json`).");
  parts.push("- Be direct, concise, and knowledgeable about ApeChain, NFTs, and Web3.");
  parts.push("- When asked about skills, reference the real library stats and help users find what they need.");
  parts.push("- Do NOT hallucinate capabilities — stick to what ApeClaw actually ships.");
  parts.push("- Keep responses focused and practical. Use short paragraphs.");

  return parts.join("\n");
}

/* ══════════════════════════════════════════════════════════
   Actions — post to chat log + emit telemetry
   ══════════════════════════════════════════════════════════ */

function postToChat(room, text, role) {
  try {
    const store = getStorage();
    const msg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: "message",
      agentId: role === "user" ? "forge-visitor" : FORGE_AGENT_ID,
      agentName: role === "user" ? "Forge Visitor" : FORGE_AGENT_DISPLAY_NAME,
      identityProvider: role === "user" ? "anonymous" : (runtimeAgentVerified ? "clawbot" : "clawbot-unverified"),
      identityMeta: role === "user" ? {} : { verified: runtimeAgentVerified, source: "forge-agent" },
      room,
      text: text.slice(0, 500),
      replyTo: null,
      reactions: {},
      reactionUsers: {},
      ts: new Date().toISOString(),
    };
    store.appendChat(msg);
  } catch (err) {
    logger.warn({ err }, "Failed to post forge agent chat");
  }
}

function emitTelemetryEvent(userMessage, responseLength) {
  try {
    const store = getStorage();
    store.appendEvent({
      v: 1,
      ts: new Date().toISOString(),
      eventType: "forge-agent-response",
      agentId: FORGE_AGENT_ID,
      sessionId: "forge-web",
      traceId: `forge_${Date.now()}`,
      command: "forge-chat",
      dryRun: false,
      chainId: 33139,
      payload: { messageLength: userMessage.length, responseLength },
      result: { ok: true },
      ok: true,
      error: null,
      source: "forge-agent",
    });
  } catch (err) {
    logger.warn({ err }, "Failed to emit forge agent telemetry");
  }
}

/* ══════════════════════════════════════════════════════════
   Rate Limiting (IP-based, for unauthenticated visitors)
   ══════════════════════════════════════════════════════════ */

function checkForgeRateLimit(req) {
  const xff = String(req.headers["x-forwarded-for"] || "").trim();
  const ip = xff ? xff.split(",")[0].trim() : String(req.socket?.remoteAddress || "unknown");
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateBuckets.set(ip, { windowStart: now, count: 1 });
    return null;
  }
  bucket.count++;
  if (bucket.count > RATE_LIMIT_MAX) {
    return { retryAfterMs: RATE_LIMIT_WINDOW_MS - (now - bucket.windowStart) };
  }
  return null;
}

// Purge stale buckets every 2 minutes
setInterval(() => {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS * 2;
  for (const [ip, bucket] of rateBuckets) {
    if (bucket.windowStart < cutoff) rateBuckets.delete(ip);
  }
}, 120_000).unref();

/* ══════════════════════════════════════════════════════════
   Init — called at server startup
   ══════════════════════════════════════════════════════════ */

export function initForgeAgent() {
  if (!PERPLEXITY_API_KEY) {
    logger.warn("PERPLEXITY_API_KEY not set — forge agent will return 503");
  }
  ensureForgeAgentIdentity();
  refreshSkillCache();
  logger.info(
    {
      agentId: FORGE_AGENT_ID,
      verified: runtimeAgentVerified,
      hasApiKey: Boolean(PERPLEXITY_API_KEY),
      model: PERPLEXITY_MODEL,
      skills: cachedSkills.summaries.length + (cachedSkills.apeClawFull ? 1 : 0),
    },
    "Forge agent initialized",
  );
}

/* ══════════════════════════════════════════════════════════
   Status — GET /api/forge/status
   Lets the frontend know if the forge agent is configured
   ══════════════════════════════════════════════════════════ */

export function handleForgeStatus(req, res) {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({
    configured: Boolean(PERPLEXITY_API_KEY),
    agentId: FORGE_AGENT_ID,
    agentName: FORGE_AGENT_DISPLAY_NAME,
    verified: runtimeAgentVerified,
    model: PERPLEXITY_MODEL,
    skills: cachedSkills.summaries.length + (cachedSkills.apeClawFull ? 1 : 0),
  }));
}

/* ══════════════════════════════════════════════════════════
   Handler — POST /api/forge/chat
   ══════════════════════════════════════════════════════════ */

export async function handleForgeChat(req, res) {
  if (!PERPLEXITY_API_KEY) {
    res.writeHead(503, { "content-type": "application/json" });
    return res.end(JSON.stringify({ error: "forge agent not configured (missing PERPLEXITY_API_KEY)" }));
  }

  const rl = checkForgeRateLimit(req);
  if (rl) {
    res.writeHead(429, { "content-type": "application/json" });
    return res.end(JSON.stringify({ error: "rate limited", retryAfterMs: rl.retryAfterMs }));
  }

  const raw = await collectBody(req, res);
  if (raw === null) return;

  let body;
  try { body = JSON.parse(raw); } catch {
    res.writeHead(400, { "content-type": "application/json" });
    return res.end(JSON.stringify({ error: "invalid JSON body" }));
  }

  const userMessage = String(body.message || body.text || "").trim();
  if (!userMessage || userMessage.length > MAX_MESSAGE_LENGTH) {
    res.writeHead(400, { "content-type": "application/json" });
    return res.end(JSON.stringify({ error: `message must be 1-${MAX_MESSAGE_LENGTH} characters` }));
  }

  const history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY_TURNS) : [];

  const snapshot = getTelemetrySnapshot();
  const systemPrompt = buildSystemPrompt(snapshot);

  const messages = [{ role: "system", content: systemPrompt }];
  for (const turn of history) {
    const role = turn.role === "assistant" ? "assistant" : "user";
    const content = String(turn.content || "").trim();
    if (content) messages.push({ role, content: content.slice(0, 2000) });
  }
  messages.push({ role: "user", content: userMessage });

  postToChat("forge", userMessage, "user");

  try {
    const perplexityRes = await fetch(PERPLEXITY_API_URL, {
      method: "POST",
      headers: {
        "authorization": `Bearer ${PERPLEXITY_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: PERPLEXITY_MODEL,
        messages,
        stream: true,
      }),
    });

    if (!perplexityRes.ok) {
      const errText = await perplexityRes.text().catch(() => "");
      logger.error({ status: perplexityRes.status, body: errText.slice(0, 500) }, "Perplexity API error");
      res.writeHead(502, { "content-type": "application/json" });
      return res.end(JSON.stringify({ error: "upstream API error", status: perplexityRes.status }));
    }

    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      "connection": "keep-alive",
    });

    let fullResponse = "";
    const reader = perplexityRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") {
          res.write("data: [DONE]\n\n");
          continue;
        }
        try {
          const chunk = JSON.parse(data);
          const text = chunk.choices?.[0]?.delta?.content || "";
          if (text) {
            fullResponse += text;
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
          }
        } catch {}
      }
    }

    if (buffer.trim()) {
      const remaining = buffer.trim();
      if (remaining.startsWith("data: ") && remaining.slice(6).trim() !== "[DONE]") {
        try {
          const chunk = JSON.parse(remaining.slice(6).trim());
          const text = chunk.choices?.[0]?.delta?.content || "";
          if (text) {
            fullResponse += text;
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
          }
        } catch {}
      }
    }

    if (!res.writableEnded) {
      res.write("data: [DONE]\n\n");
      res.end();
    }

    if (fullResponse) {
      postToChat("forge", fullResponse.slice(0, 500), "agent");
      emitTelemetryEvent(userMessage, fullResponse.length);
    }
  } catch (err) {
    logger.error({ err }, "Forge agent stream error");
    if (!res.headersSent) {
      res.writeHead(500, { "content-type": "application/json" });
      return res.end(JSON.stringify({ error: "internal error" }));
    }
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ text: "\n\n[Connection interrupted]" })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    }
  }
}
