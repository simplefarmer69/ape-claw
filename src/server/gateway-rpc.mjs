/**
 * Lightweight OpenClaw Gateway WebSocket RPC client.
 *
 * Connects directly to the gateway's WebSocket endpoint (ws://127.0.0.1:<port>)
 * and speaks the same JSON-RPC frame protocol used by `openclaw agent` CLI,
 * eliminating the overhead of spawning child processes.
 */

import crypto, { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const PROTOCOL_VERSION = 3;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let _pkgVersion;
function getPackageVersion() {
  if (_pkgVersion) return _pkgVersion;
  try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../package.json"), "utf8"));
    _pkgVersion = pkg.version || "0.0.0";
  } catch {
    _pkgVersion = "0.0.0";
  }
  return _pkgVersion;
}

function readOpenClawConfig() {
  const candidates = [
    path.join(os.homedir(), ".openclaw", "openclaw.json"),
    path.join(os.homedir(), ".openclaw-dev", "openclaw.json"),
  ];
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      const raw = fs.readFileSync(p, "utf8");
      const noBlockComments = raw.replace(/\/\*[\s\S]*?\*\//g, "");
      const noLineComments = noBlockComments.replace(/^\s*\/\/.*$/gm, "");
      const noTrailingCommas = noLineComments.replace(/,\s*([}\]])/g, "$1");
      return JSON.parse(noTrailingCommas);
    } catch {}
  }
  return null;
}

function resolveGatewayEndpoint() {
  const cfg = readOpenClawConfig();
  const port = cfg?.gateway?.port || 18789;
  const token = cfg?.gateway?.auth?.token ||
    process.env.OPENCLAW_GATEWAY_TOKEN || "";
  return { url: `ws://127.0.0.1:${port}`, token, port };
}

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function base64UrlEncode(buf) {
  return Buffer.from(buf).toString("base64url");
}

function derivePublicKeyRaw(pem) {
  const key = crypto.createPublicKey(pem);
  const spki = key.export({ type: "spki", format: "der" });
  return spki.subarray(ED25519_SPKI_PREFIX.length);
}

function loadDeviceIdentity() {
  const identityPath = path.join(os.homedir(), ".openclaw", "identity", "device.json");
  try {
    if (!fs.existsSync(identityPath)) return null;
    const parsed = JSON.parse(fs.readFileSync(identityPath, "utf8"));
    if (parsed?.version === 1 && parsed.deviceId && parsed.publicKeyPem && parsed.privateKeyPem) {
      return parsed;
    }
  } catch {}
  return null;
}

function signDevicePayload(privateKeyPem, payload) {
  const key = crypto.createPrivateKey(privateKeyPem);
  return base64UrlEncode(crypto.sign(null, Buffer.from(payload, "utf8"), key));
}

function buildDeviceAuth(identity, { clientId, clientMode, role, scopes, signedAtMs, token, nonce }) {
  const version = nonce ? "v2" : "v1";
  const scopeStr = scopes.join(",");
  const parts = [version, identity.deviceId, clientId, clientMode, role, scopeStr, String(signedAtMs), token || ""];
  if (version === "v2") parts.push(nonce || "");
  const payload = parts.join("|");
  const signature = signDevicePayload(identity.privateKeyPem, payload);
  return {
    id: identity.deviceId,
    publicKey: base64UrlEncode(derivePublicKeyRaw(identity.publicKeyPem)),
    signature,
    signedAt: signedAtMs,
    nonce: nonce || undefined,
  };
}

let _cachedIdentity = undefined;
function getCachedDeviceIdentity() {
  if (_cachedIdentity === undefined) _cachedIdentity = loadDeviceIdentity();
  return _cachedIdentity;
}

/**
 * Send a single RPC request through the gateway and return the result.
 * Manages the full lifecycle: connect → auth → request → close.
 */
export async function gatewayRpc(method, params, opts = {}) {
  const { url, token } = resolveGatewayEndpoint();
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const expectFinal = opts.expectFinal ?? false;

  return new Promise((resolve, reject) => {
    let settled = false;
    let connectStarted = false;
    let ws;

    const pending = new Map();

    const finish = (err, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      for (const [, entry] of pending) entry.reject(err || new Error("connection closed"));
      pending.clear();
      try { ws?.close(); } catch {}
      if (err) reject(err);
      else resolve(value);
    };

    const timer = setTimeout(() => {
      finish(new Error(`gateway RPC timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    try {
      ws = new WebSocket(url);
    } catch (err) {
      return finish(new Error(`failed to create WebSocket: ${err.message}`));
    }

    function sendRequest(reqMethod, reqParams, reqOpts = {}) {
      const id = randomUUID();
      const frame = { type: "req", id, method: reqMethod, params: reqParams };
      return new Promise((res, rej) => {
        pending.set(id, { resolve: res, reject: rej, expectFinal: reqOpts.expectFinal ?? false });
        ws.send(JSON.stringify(frame));
      });
    }

    const CLIENT_ID = "cli";
    const CLIENT_MODE = "cli";
    const ROLE = "operator";
    const SCOPES = ["operator.admin", "operator.write", "operator.approvals", "operator.pairing"];
    const instanceId = randomUUID();

    async function doConnectAndRequest(nonce) {
      if (connectStarted) return;
      connectStarted = true;

      const auth = token ? { token } : undefined;
      const signedAtMs = Date.now();
      const identity = getCachedDeviceIdentity();
      const device = identity
        ? buildDeviceAuth(identity, {
            clientId: CLIENT_ID, clientMode: CLIENT_MODE, role: ROLE,
            scopes: SCOPES, signedAtMs, token: token || null, nonce,
          })
        : undefined;

      try {
        await sendRequest("connect", {
          minProtocol: PROTOCOL_VERSION, maxProtocol: PROTOCOL_VERSION,
          client: {
            id: CLIENT_ID, displayName: "ApeClaw Forge",
            version: getPackageVersion(), platform: process.platform,
            mode: CLIENT_MODE, instanceId,
          },
          caps: [], auth, role: ROLE, scopes: SCOPES, device,
        });
        const result = await sendRequest(method, params, { expectFinal });
        finish(null, result);
      } catch (err) {
        finish(err);
      }
    }

    ws.onopen = () => { doConnectAndRequest(null); };

    ws.onmessage = (event) => {
      let parsed;
      try { parsed = JSON.parse(String(event.data)); } catch { return; }

      if (parsed.type === "evt") {
        if (parsed.event === "connect.challenge") {
          connectStarted = false;
          doConnectAndRequest(parsed.payload?.nonce ?? null);
        }
        return;
      }

      if (parsed.type === "res" || parsed.type === "err") {
        const entry = pending.get(parsed.id);
        if (!entry) return;

        if (parsed.type === "err") {
          pending.delete(parsed.id);
          entry.reject(new Error(parsed.error?.message ?? "unknown gateway error"));
          return;
        }

        if (entry.expectFinal && parsed.payload?.status === "accepted") return;

        pending.delete(parsed.id);
        if (parsed.ok === false) {
          entry.reject(new Error(parsed.error?.message ?? "gateway request failed"));
        } else {
          entry.resolve(parsed.payload);
        }
      }
    };

    ws.onerror = (err) => {
      finish(new Error(`gateway WebSocket error: ${err.message || "connection failed"}`));
    };

    ws.onclose = (event) => {
      if (!settled) {
        finish(new Error(`gateway closed (${event.code}): ${event.reason || "no reason"}`));
      }
    };
  });
}

/**
 * Send a message to the agent via the gateway and return the parsed result.
 */
export async function gatewayAgentTurn(message, opts = {}) {
  const sessionId = opts.sessionId ?? "main";
  const agentId = opts.agentId ?? "main";
  const sessionKey = `agent:${agentId}:${sessionId}`;
  const timeoutMs = opts.timeoutMs ?? 150_000;

  const params = {
    message,
    agentId,
    sessionId,
    sessionKey,
    deliver: false,
    channel: "webchat",
    idempotencyKey: randomUUID(),
    thinking: opts.thinking,
  };

  const response = await gatewayRpc("agent", params, {
    timeoutMs,
    expectFinal: true,
  });

  return response;
}

/**
 * Check if the gateway is reachable.
 */
export async function gatewayHealthCheck() {
  try {
    const result = await gatewayRpc("health", {}, { timeoutMs: 10_000 });
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Extract text from a gateway agent response.
 */
export function extractAgentText(response) {
  const payloads = response?.result?.payloads ?? response?.payloads ?? [];
  if (Array.isArray(payloads) && payloads.length) {
    const txt = payloads
      .map((p) => String(p?.text || "").trim())
      .filter(Boolean)
      .join("\n");
    if (txt) return txt;
  }

  const direct = String(response?.result?.text || response?.text || "").trim();
  if (direct) return direct;

  const summary = String(response?.summary || response?.result?.summary || "").trim();
  if (summary === "completed" && (response?.status === "ok" || response?.status === "completed")) {
    return "Done \u2014 I completed the task using my tools. Let me know if you need anything else.";
  }

  return "";
}
