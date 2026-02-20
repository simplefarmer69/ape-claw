/**
 * Routes: /events (SSE), /events/backlog, POST /api/events
 */

import { verifyClawbot } from "../../lib/clawbots.mjs";
import { getStorage } from "../storage/index.mjs";
import { addTelemetryClient, nextEventId } from "../sse.mjs";
import { collectBody } from "../middleware/body-limit.mjs";

export function handleEventsSse(req, res) {
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });
  res.write("\n");

  const lastEventId = req.headers["last-event-id"];
  if (lastEventId) {
    const store = getStorage();
    const backlog = store.getEventBacklog(300);
    for (const evt of backlog) {
      const id = nextEventId();
      res.write(`id: ${id}\ndata: ${JSON.stringify(evt)}\n\n`);
    }
  }

  const remove = addTelemetryClient(res);
  req.on("close", remove);
}

export function handleEventsBacklog(req, res, reqUrl) {
  const store = getStorage();
  const limit = Math.max(1, Math.min(1000, Number(reqUrl?.searchParams?.get("limit") || 300)));
  const since = reqUrl?.searchParams?.get("since") || "";
  let events = store.getEventBacklog(limit);
  if (since) {
    events = events.filter((e) => e.ts > since);
  }
  res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ events }));
}

export async function handlePostEvent(req, res) {
  const raw = await collectBody(req, res);
  if (raw === null) return;
  let body;
  try { body = JSON.parse(raw); } catch {
    res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ error: "invalid JSON body" }));
  }

  const eventType = String(body?.eventType || "").trim();
  if (!eventType) {
    res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ error: "eventType is required" }));
  }

  const headerAgentId = String(req.headers["x-agent-id"] || "").trim();
  const headerAgentToken = String(req.headers["x-agent-token"] || "").trim();
  if (!headerAgentId || !headerAgentToken) {
    res.writeHead(401, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ error: "missing credentials: x-agent-id + x-agent-token are required" }));
  }
  const verification = verifyClawbot({ agentId: headerAgentId, agentToken: headerAgentToken });
  if (!verification.verified) {
    res.writeHead(403, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ error: "not verified", reason: verification.reason }));
  }

  const evt = {
    v: Number(body?.v || 1),
    ts: typeof body?.ts === "string" ? body.ts
      : (typeof body?.ts === "number" && Number.isFinite(body.ts)) ? new Date(body.ts * 1000).toISOString()
        : new Date().toISOString(),
    eventType,
    agentId: headerAgentId,
    sessionId: String(body?.sessionId || "remote-session"),
    traceId: String(body?.traceId || `trace_${Date.now()}`),
    command: String(body?.command || ""),
    dryRun: Boolean(body?.dryRun),
    chainId: Number(body?.chainId || 33139),
    payload: (body?.payload || body?.data) && typeof (body?.payload || body?.data) === "object" ? (body?.payload || body?.data) : {},
    result: body?.result && typeof body.result === "object" ? body.result : {},
    ok: body?.ok !== false,
    error: body?.error || null,
    ...(body?.source ? { source: String(body.source) } : {}),
  };

  const store = getStorage();
  store.appendEvent(evt);

  res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  return res.end(JSON.stringify({ ok: true, event: evt }));
}
