import path from "node:path";

const ROOT_OVERRIDE = String(process.env.APE_CLAW_ROOT || "").trim();
const STATE_DIR_OVERRIDE = String(process.env.APE_CLAW_STATE_DIR || "").trim();

export const ROOT = ROOT_OVERRIDE ? path.resolve(ROOT_OVERRIDE) : process.cwd();
export const STATE_DIR = STATE_DIR_OVERRIDE ? path.resolve(STATE_DIR_OVERRIDE) : path.join(ROOT, "state");
export const POLICY_PATH = path.join(ROOT, "config", "policy.json");
export const ALLOWLIST_PATH = path.join(ROOT, "allowlists", "recommended.apechain.json");
export const OPENSEA_OVERRIDES_PATH = path.join(ROOT, "allowlists", "opensea-slug-overrides.json");
export const EVENTS_PATH = path.join(STATE_DIR, "events.jsonl");
export const QUOTES_PATH = path.join(STATE_DIR, "quotes.json");
export const BRIDGE_REQUESTS_PATH = path.join(STATE_DIR, "bridge-requests.json");
export const CLAWBOTS_PATH = path.join(ROOT, "config", "clawbots.json");
export const CHAT_PATH = path.join(STATE_DIR, "chat.jsonl");

