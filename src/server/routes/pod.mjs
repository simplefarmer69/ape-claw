/**
 * Routes: /api/pod/*
 */

import fs from "node:fs";
import path from "node:path";
import { ensureDir } from "../../lib/io.mjs";
import { getStorage } from "../storage/index.mjs";
import { requireSkillWriteAuth } from "../middleware/auth.mjs";

function getPodStatus() {
  const store = getStorage();
  const workspacePath = store.findPodWorkspaceDir();
  if (!workspacePath) return { ok: true, status: "not-initialized", workspacePath: null };

  const agentsMdPath = path.join(workspacePath, "AGENTS.md");
  const tasksPath = path.join(workspacePath, "memory", "active-tasks.md");
  const stopFlagPath = path.join(workspacePath, "stop.flag");
  const heartbeatPath = path.join(workspacePath, "state", "last-heartbeat.json");

  const hasAgentsMd = fs.existsSync(agentsMdPath);
  const hasTasks = fs.existsSync(tasksPath);
  const stopped = fs.existsSync(stopFlagPath);

  let lastHeartbeat = null;
  if (fs.existsSync(heartbeatPath)) {
    try { lastHeartbeat = JSON.parse(fs.readFileSync(heartbeatPath, "utf8"))?.timestamp || null; } catch {}
  }

  return {
    ok: true,
    status: hasAgentsMd ? (stopped ? "stopped" : "running") : "not-initialized",
    workspacePath, hasAgentsMd, hasTasks, stopped, lastHeartbeat,
  };
}

export function handlePodStatus(req, res) {
  res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  return res.end(JSON.stringify(getPodStatus()));
}

export function handlePodStop(req, res) {
  const auth = requireSkillWriteAuth(req);
  if (!auth.ok) {
    res.writeHead(401, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: false, error: "unauthorized (set x-registration-key or x-agent-id/x-agent-token)" }));
  }
  const store = getStorage();
  const workspacePath = store.findPodWorkspaceDir();
  if (!workspacePath) {
    res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: false, error: "pod workspace not found" }));
  }
  try {
    ensureDir(workspacePath);
    const stopFlagPath = path.join(workspacePath, "stop.flag");
    fs.writeFileSync(stopFlagPath, new Date().toISOString() + "\n");
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: true, action: "stop", flagPath: stopFlagPath }));
  } catch (err) {
    res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: false, error: err.message || "failed to create stop flag" }));
  }
}
