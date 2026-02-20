/**
 * Routes: /api/clawbots/*, /api/invites/*
 */

import fs from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { CLAWBOTS_PATH } from "../../lib/paths.mjs";
import { verifyClawbot, registerClawbot } from "../../lib/clawbots.mjs";
import { getStorage } from "../storage/index.mjs";
import { getRegistrationKey } from "../middleware/auth.mjs";
import { collectBody } from "../middleware/body-limit.mjs";

const OPEN_REGISTRATION = /^(1|true|yes|on)$/i.test(String(process.env.APE_CLAW_OPEN_REGISTRATION || "").trim());
const REGISTRATION_COOLDOWN_MS = Math.max(0, Number(process.env.APE_CLAW_REGISTRATION_COOLDOWN_MS || 10000));
const INVITE_TTL_MS = Math.max(60_000, Number(process.env.APE_CLAW_INVITE_TTL_MS || 24 * 60 * 60 * 1000));
const INVITE_MAX_USES = Math.max(1, Number(process.env.APE_CLAW_INVITE_MAX_USES || 5));
const registrationByIp = new Map();

function sha256(input) { return createHash("sha256").update(String(input)).digest("hex"); }

function clientIpFromReq(req) {
  const xff = String(req.headers["x-forwarded-for"] || "").trim();
  if (xff) return xff.split(",")[0].trim();
  return String(req.socket?.remoteAddress || "").trim() || "unknown";
}

function mintInvite({ ttlMs = INVITE_TTL_MS, uses = 1 } = {}) {
  const store = getStorage();
  const safeUses = Math.max(1, Math.min(INVITE_MAX_USES, Number(uses) || 1));
  const safeTtl = Math.max(60_000, Math.min(7 * 24 * 60 * 60 * 1000, Number(ttlMs) || INVITE_TTL_MS));
  const token = `inv_${randomUUID().replace(/-/g, "")}`;
  const tokenHash = sha256(token);
  const now = Date.now();
  const invites = store.readInvites();
  invites.invites[tokenHash] = {
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + safeTtl).toISOString(),
    usesRemaining: safeUses,
  };
  store.writeInvites(invites);
  return { token, tokenHash, expiresAt: invites.invites[tokenHash].expiresAt, usesRemaining: safeUses };
}

function consumeInvite(inviteToken) {
  const store = getStorage();
  const token = String(inviteToken || "").trim();
  if (!token) return { ok: false, reason: "missing invite" };
  const tokenHash = sha256(token);
  const invites = store.readInvites();
  const row = invites.invites?.[tokenHash];
  if (!row) return { ok: false, reason: "invite not found" };
  const now = Date.now();
  const exp = new Date(row.expiresAt || 0).getTime();
  if (!exp || exp <= now) return { ok: false, reason: "invite expired" };
  const remaining = Number(row.usesRemaining || 0);
  if (remaining <= 0) return { ok: false, reason: "invite exhausted" };
  invites.invites[tokenHash] = { ...row, usesRemaining: remaining - 1, lastUsedAt: new Date(now).toISOString() };
  store.writeInvites(invites);
  return { ok: true };
}

export function handleClawbotsList(req, res) {
  if (!fs.existsSync(CLAWBOTS_PATH)) {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ count: 0, clawbots: [], sharedKeyConfigured: false }));
  }
  try {
    const raw = JSON.parse(fs.readFileSync(CLAWBOTS_PATH, "utf8"));
    const agents = raw.agents || {};
    const clawbots = Object.entries(agents).map(([id, a]) => ({
      agentId: id, name: a.name || id, enabled: a.enabled !== false, createdAt: a.createdAt || null,
    }));
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    const sharedKeyConfigured = Boolean(raw.sharedOpenseaApiKey || process.env.APE_CLAW_SHARED_OPENSEA_KEY);
    return res.end(JSON.stringify({ count: clawbots.length, clawbots, sharedKeyConfigured }));
  } catch (err) {
    res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ error: err.message }));
  }
}

export function handleClawbotsVerify(req, res) {
  const headerAgentId = String(req.headers["x-agent-id"] || "").trim();
  const headerAgentToken = String(req.headers["x-agent-token"] || "").trim();
  if (!headerAgentId || !headerAgentToken) {
    res.writeHead(401, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: false, error: "missing credentials: x-agent-id + x-agent-token are required" }));
  }
  const verification = verifyClawbot({ agentId: headerAgentId, agentToken: headerAgentToken });
  if (!verification.verified) {
    res.writeHead(403, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: false, error: "not verified", reason: verification.reason }));
  }
  res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  return res.end(JSON.stringify({
    ok: true, verified: true, agent: verification.agent, sharedOpenseaApiKey: verification.sharedOpenseaApiKey || "",
  }));
}

export async function handleInviteCreate(req, res) {
  const REGISTRATION_KEY = getRegistrationKey();
  const raw = await collectBody(req, res);
  if (raw === null) return;
  try {
    const body = JSON.parse(raw);
    if (!REGISTRATION_KEY) {
      res.writeHead(503, { "content-type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({ error: "invite creation disabled: backend missing APE_CLAW_REGISTRATION_KEY" }));
    }
    const providedKey = String(req.headers["x-registration-key"] || "").trim();
    if (!providedKey || providedKey !== REGISTRATION_KEY) {
      res.writeHead(403, { "content-type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({ error: "invalid registration key" }));
    }
    const invite = mintInvite({ ttlMs: body?.ttlMs, uses: body?.uses });
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({
      ok: true, invite: invite.token, expiresAt: invite.expiresAt, usesRemaining: invite.usesRemaining,
      note: "Share this invite privately. It can be redeemed via clawbot register --invite <token>.",
    }));
  } catch {
    res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ error: "invalid JSON body" }));
  }
}

export async function handleClawbotsRegister(req, res) {
  const REGISTRATION_KEY = getRegistrationKey();
  const raw = await collectBody(req, res);
  if (raw === null) return;
  try {
    const body = JSON.parse(raw);
    const inviteToken = String(body?.invite || "").trim();
    const inviteOk = inviteToken ? consumeInvite(inviteToken) : { ok: false, reason: "missing invite" };

    if (!REGISTRATION_KEY && !OPEN_REGISTRATION && !inviteOk.ok) {
      res.writeHead(503, { "content-type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({ error: "registration is disabled: use an invite, set APE_CLAW_REGISTRATION_KEY, or enable APE_CLAW_OPEN_REGISTRATION" }));
    }
    const hasValidKey = (() => {
      if (!REGISTRATION_KEY) return false;
      const providedKey = String(req.headers["x-registration-key"] || "").trim();
      return Boolean(providedKey) && providedKey === REGISTRATION_KEY;
    })();
    if (!OPEN_REGISTRATION && !hasValidKey && !inviteOk.ok) {
      res.writeHead(403, { "content-type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({ error: "registration not allowed (missing invite or invalid registration key)" }));
    }
    if (OPEN_REGISTRATION && !hasValidKey && REGISTRATION_COOLDOWN_MS > 0) {
      const ip = clientIpFromReq(req);
      const now = Date.now();
      const last = Number(registrationByIp.get(ip) || 0);
      if (last && now - last < REGISTRATION_COOLDOWN_MS) {
        const waitMs = REGISTRATION_COOLDOWN_MS - (now - last);
        res.writeHead(429, { "content-type": "application/json; charset=utf-8" });
        return res.end(JSON.stringify({ error: "registration rate limited", retryAfterMs: waitMs }));
      }
      registrationByIp.set(ip, now);
    }

    const agentId = String(body?.agentId || "").trim();
    const displayName = String(body?.name || agentId || "").trim();
    if (!agentId) {
      res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({ error: "agentId is required" }));
    }
    try {
      const reg = registerClawbot({ agentId, displayName });
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({
        registered: true, agentId: reg.agentId, name: reg.displayName, token: reg.token,
        note: "Save this token — it is shown only once. Use as APE_CLAW_AGENT_TOKEN or --agent-token.",
      }));
    } catch (err) {
      res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({ error: err.message || "registration failed" }));
    }
  } catch {
    res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ error: "invalid JSON body" }));
  }
}
