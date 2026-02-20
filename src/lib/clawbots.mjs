import { createHash, randomUUID } from "node:crypto";
import { readJson, writeJson } from "./io.mjs";
import { CLAWBOTS_PATH } from "./paths.mjs";

/**
 * Clawbot verification system.
 *
 * Verified bots get access to the shared OpenSea API key so that bot
 * operators do NOT need their own key. The shared key is read from the
 * APE_CLAW_SHARED_OPENSEA_KEY env var (never stored in config files).
 *
 * Config format (config/clawbots.json):
 * {
 *   "agents": {
 *     "the-clawllector": {
 *       "name": "The Clawllector",
 *       "tokenHash": "<sha256 of agent token>",
 *       "createdAt": "...",
 *       "enabled": true
 *     }
 *   }
 * }
 */

function resolveSharedOpenseaKey() {
  return String(process.env.APE_CLAW_SHARED_OPENSEA_KEY || "").trim();
}

function hashToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

export function loadClawbotsConfig() {
  return readJson(CLAWBOTS_PATH, null);
}

export function generateAgentToken() {
  return `claw_${randomUUID().replace(/-/g, "")}`;
}

/**
 * Register a new clawbot agent. Returns the agent token (shown once).
 */
export function registerClawbot({ agentId, displayName }) {
  const config = loadClawbotsConfig() || { agents: {} };
  if (!config.agents) config.agents = {};
  if (config.agents[agentId]) {
    throw new Error(`Agent "${agentId}" already registered. Use a different --agent-id.`);
  }
  const token = generateAgentToken();
  config.agents[agentId] = {
    name: displayName || agentId,
    tokenHash: hashToken(token),
    createdAt: new Date().toISOString(),
    enabled: true,
  };
  writeJson(CLAWBOTS_PATH, config);
  return { agentId, token, displayName: config.agents[agentId].name };
}

/**
 * Verify a clawbot's credentials.
 * Returns { verified, agent, sharedOpenseaApiKey } or { verified: false }.
 */
export function verifyClawbot({ agentId, agentToken }) {
  if (!agentId || !agentToken) return { verified: false, reason: "missing credentials" };
  const config = loadClawbotsConfig();
  if (!config || !config.agents) return { verified: false, reason: "no clawbots config" };
  const agent = config.agents[agentId];
  if (!agent) return { verified: false, reason: `agent "${agentId}" not registered` };
  if (!agent.enabled) return { verified: false, reason: `agent "${agentId}" is disabled` };
  const expectedHash = agent.tokenHash;
  const gotHash = hashToken(agentToken);
  if (gotHash !== expectedHash) return { verified: false, reason: "invalid token" };
  return {
    verified: true,
    agent: { id: agentId, name: agent.name },
    sharedOpenseaApiKey: resolveSharedOpenseaKey(),
  };
}

/**
 * List all registered clawbots (no secrets).
 */
export function listClawbots() {
  const config = loadClawbotsConfig();
  if (!config || !config.agents) return [];
  return Object.entries(config.agents).map(([id, a]) => ({
    agentId: id,
    name: a.name,
    enabled: a.enabled,
    createdAt: a.createdAt,
  }));
}
