/**
 * Auth middleware for route handlers.
 *
 * Provides two auth modes:
 * - requireSkillWriteAuth: admin key OR authenticated clawbot
 * - resolveChatAuth: clawbot auth OR Moltbook identity verification
 */

import { verifyClawbot } from "../../lib/clawbots.mjs";

const MOLTBOOK_API_BASE = String(process.env.MOLTBOOK_API_BASE || "https://www.moltbook.com/api/v1").replace(/\/+$/, "");
const MOLTBOOK_APP_KEY = String(process.env.MOLTBOOK_APP_KEY || "").trim();
const REGISTRATION_KEY = String(process.env.APE_CLAW_REGISTRATION_KEY || "").trim();

export function getRegistrationKey() { return REGISTRATION_KEY; }
export function getMoltbookAppKey() { return MOLTBOOK_APP_KEY; }
export function getMoltbookApiBase() { return MOLTBOOK_API_BASE; }

function isLocalRequest(req) {
  const ip = String(req?.socket?.remoteAddress || "");
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

export function requireSkillWriteAuth(req) {
  const adminKey = String(req.headers["x-registration-key"] || "").trim();
  if (adminKey && REGISTRATION_KEY && adminKey === REGISTRATION_KEY) {
    return { ok: true, mode: "admin", agentId: null };
  }
  const agentId = String(req.headers["x-agent-id"] || "").trim();
  const agentToken = String(req.headers["x-agent-token"] || "").trim();
  if (agentId && agentToken) {
    try {
      const v = verifyClawbot({ agentId, agentToken });
      if (v?.verified) return { ok: true, mode: "agent", agentId };
    } catch {}
  }
  // Local Forge installs are allowed without clawbot credentials.
  // Credentials remain optional for users who want global telemetry/dashboard posting.
  if (isLocalRequest(req)) {
    return { ok: true, mode: "local", agentId: "local-forge" };
  }
  return { ok: false, mode: "none", agentId: null };
}

export async function verifyMoltbookIdentity(identityToken) {
  const token = String(identityToken || "").trim();
  if (!token) return { verified: false, reason: "missing identity token" };
  if (!MOLTBOOK_APP_KEY) return { verified: false, reason: "MOLTBOOK_APP_KEY not configured on backend" };
  try {
    const r = await fetch(`${MOLTBOOK_API_BASE}/agents/verify-identity`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-moltbook-app-key": MOLTBOOK_APP_KEY },
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

export async function resolveChatAuth(req, body) {
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
        meta: { karma: Number(agent.karma || 0), claimed: Boolean(agent.is_claimed) },
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
