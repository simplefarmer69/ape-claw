/**
 * Routes: /api/quotes/*, /api/bridge-requests/*
 *
 * Server-side quote and bridge-request management.
 * When CLI agents use APE_CLAW_TELEMETRY_URL, they POST/GET quotes and
 * bridge requests here instead of reading/writing local state files.
 * This ensures daily spend caps are enforced globally.
 */

import { getStorage } from "../storage/index.mjs";
import { verifyClawbot } from "../../lib/clawbots.mjs";
import { collectBody } from "../middleware/body-limit.mjs";

function requireAgentAuth(req, res) {
  const agentId = String(req.headers["x-agent-id"] || "").trim();
  const agentToken = String(req.headers["x-agent-token"] || "").trim();
  if (!agentId || !agentToken) {
    res.writeHead(401, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "missing credentials" }));
    return null;
  }
  const v = verifyClawbot({ agentId, agentToken });
  if (!v.verified) {
    res.writeHead(403, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "not verified", reason: v.reason }));
    return null;
  }
  return agentId;
}

// ── Quotes ──

export async function handleCreateQuote(req, res) {
  const agentId = requireAgentAuth(req, res);
  if (!agentId) return;
  const raw = await collectBody(req, res);
  if (raw === null) return;
  try {
    const body = JSON.parse(raw);
    const quoteId = body.quoteId || `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const store = getStorage();
    const data = { ...body, quoteId, agentId, createdAt: new Date().toISOString() };
    store.saveQuote(quoteId, data);
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: true, quote: data }));
  } catch (err) {
    res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ error: err.message }));
  }
}

export function handleGetQuote(req, res, reqUrl) {
  const agentId = requireAgentAuth(req, res);
  if (!agentId) return;
  const quoteId = reqUrl.pathname.split("/").pop();
  const store = getStorage();
  const quote = store.getQuote(quoteId);
  if (!quote) {
    res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ error: "quote not found" }));
  }
  res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  return res.end(JSON.stringify({ ok: true, quote }));
}

export async function handlePatchQuote(req, res, reqUrl) {
  const agentId = requireAgentAuth(req, res);
  if (!agentId) return;
  const quoteId = reqUrl.pathname.split("/").pop();
  const raw = await collectBody(req, res);
  if (raw === null) return;
  try {
    const patch = JSON.parse(raw);
    const store = getStorage();
    const updated = store.updateQuote(quoteId, patch);
    if (!updated) {
      res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({ error: "quote not found" }));
    }
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: true, quote: updated }));
  } catch (err) {
    res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ error: err.message }));
  }
}

export function handleQuotesSpendToday(req, res) {
  const agentId = requireAgentAuth(req, res);
  if (!agentId) return;
  const store = getStorage();
  const spent = store.getQuotesSpendToday();
  res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  return res.end(JSON.stringify({ ok: true, spentToday: spent }));
}

// ── Bridge requests ──

export async function handleCreateBridgeRequest(req, res) {
  const agentId = requireAgentAuth(req, res);
  if (!agentId) return;
  const raw = await collectBody(req, res);
  if (raw === null) return;
  try {
    const body = JSON.parse(raw);
    const requestId = body.requestId || `br_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const store = getStorage();
    const data = { ...body, requestId, agentId, createdAt: new Date().toISOString() };
    store.saveBridgeRequest(requestId, data);
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: true, bridgeRequest: data }));
  } catch (err) {
    res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ error: err.message }));
  }
}

export function handleGetBridgeRequest(req, res, reqUrl) {
  const agentId = requireAgentAuth(req, res);
  if (!agentId) return;
  const requestId = reqUrl.pathname.split("/").pop();
  const store = getStorage();
  const request = store.getBridgeRequest(requestId);
  if (!request) {
    res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ error: "bridge request not found" }));
  }
  res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  return res.end(JSON.stringify({ ok: true, bridgeRequest: request }));
}

export async function handlePatchBridgeRequest(req, res, reqUrl) {
  const agentId = requireAgentAuth(req, res);
  if (!agentId) return;
  const requestId = reqUrl.pathname.split("/").pop();
  const raw = await collectBody(req, res);
  if (raw === null) return;
  try {
    const patch = JSON.parse(raw);
    const store = getStorage();
    const updated = store.updateBridgeRequest(requestId, patch);
    if (!updated) {
      res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({ error: "bridge request not found" }));
    }
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: true, bridgeRequest: updated }));
  } catch (err) {
    res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ error: err.message }));
  }
}

export function handleBridgeSpendToday(req, res) {
  const agentId = requireAgentAuth(req, res);
  if (!agentId) return;
  const store = getStorage();
  const spent = store.getBridgeSpendToday();
  res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  return res.end(JSON.stringify({ ok: true, spentToday: spent }));
}
