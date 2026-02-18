import { appendJsonl, nowIso, randomId } from "./io.mjs";
import { EVENTS_PATH } from "./paths.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TELEMETRY_BASE = String(process.env.APE_CLAW_TELEMETRY_URL || "").trim().replace(/\/+$/, "");
const TELEMETRY_REMOTE_ONLY = /^(1|true|yes|on)$/i.test(String(process.env.APE_CLAW_TELEMETRY_REMOTE_ONLY || "").trim());

function authStorePath() {
  return path.join(os.homedir(), ".ape-claw", "auth.json");
}

function loadAuthStore() {
  try {
    const p = authStorePath();
    if (!fs.existsSync(p)) return {};
    const raw = fs.readFileSync(p, "utf8");
    const j = JSON.parse(raw);
    return j && typeof j === "object" ? j : {};
  } catch {
    return {};
  }
}

function authHeadersForRemoteEvent(evt) {
  const stored = loadAuthStore();
  const fromEnvId = String(process.env.APE_CLAW_AGENT_ID || "").trim();
  const fromEnvToken = String(process.env.APE_CLAW_AGENT_TOKEN || "").trim();
  const agentId = fromEnvId || String(stored.agentId || "").trim() || String(evt.agentId || "").trim();
  const token = fromEnvToken || String(stored.agentToken || "").trim();
  return {
    "content-type": "application/json",
    ...(agentId ? { "x-agent-id": agentId } : {}),
    ...(token ? { "x-agent-token": token } : {}),
  };
}

async function sendRemoteEvent(evt) {
  if (!TELEMETRY_BASE) return;
  const url = `${TELEMETRY_BASE}/api/events`;
  const res = await fetch(url, {
    method: "POST",
    headers: authHeadersForRemoteEvent(evt),
    body: JSON.stringify(evt),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`remote telemetry failed (${res.status})${body ? `: ${body.slice(0, 200)}` : ""}`);
  }
}

export function emitEvent({
  eventType,
  agentId = "local-cli",
  sessionId = "local-session",
  traceId = null,
  command = "",
  dryRun = true,
  chainId = 33139,
  payload = {},
  result = {},
  ok = true,
  error = null,
}) {
  const evt = {
    v: 1,
    ts: nowIso(),
    eventType,
    agentId,
    sessionId,
    traceId: traceId || randomId("trace"),
    command,
    dryRun,
    chainId,
    payload,
    result,
    ok,
    error,
  };
  if (!TELEMETRY_REMOTE_ONLY) {
    appendJsonl(EVENTS_PATH, evt);
  }
  if (TELEMETRY_BASE) {
    void sendRemoteEvent(evt).catch((err) => {
      // Telemetry emission must never break command execution.
      console.warn(`[telemetry] ${err.message}`);
    });
  }
  return evt;
}

