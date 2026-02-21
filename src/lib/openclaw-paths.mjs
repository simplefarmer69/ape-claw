import os from "node:os";
import path from "node:path";

function clean(v) {
  return String(v || "").trim();
}

function uniq(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const v = clean(item);
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

export function openClawHomeDir() {
  return clean(process.env.OPENCLAW_HOME) || os.homedir();
}

export function openClawRootCandidates() {
  const home = openClawHomeDir();
  const stateDir = clean(process.env.OPENCLAW_STATE_DIR);
  const configPath = clean(process.env.OPENCLAW_CONFIG_PATH);
  const configDir = configPath ? path.dirname(configPath) : "";
  return uniq([
    path.join(home, ".openclaw"),
    stateDir,
    configDir,
    "/data/.clawdbot",
  ]);
}

export function openClawSkillsDirCandidates() {
  const explicitSkillsDir = clean(process.env.OPENCLAW_SKILLS_DIR);
  const roots = openClawRootCandidates();
  return uniq([
    explicitSkillsDir,
    ...roots.map((r) => path.join(r, "skills")),
  ]);
}

export function openClawWorkspaceSkillsDirCandidates() {
  return uniq(openClawRootCandidates().map((r) => path.join(r, "workspace", "skills")));
}

export function openClawConfigCandidates() {
  const explicit = clean(process.env.OPENCLAW_CONFIG_PATH);
  const roots = openClawRootCandidates();
  return uniq([
    explicit,
    ...roots.map((r) => path.join(r, "openclaw.json")),
  ]);
}

export function openClawEnvFileCandidates() {
  return uniq(openClawRootCandidates().map((r) => path.join(r, ".env")));
}

export function openClawControlUiIndexCandidates() {
  return uniq(openClawRootCandidates().map((r) => path.join(r, "dist", "control-ui", "index.html")));
}
