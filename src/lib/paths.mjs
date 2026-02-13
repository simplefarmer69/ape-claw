import path from "node:path";

export const ROOT = process.cwd();
export const STATE_DIR = path.join(ROOT, "state");
export const POLICY_PATH = path.join(ROOT, "config", "policy.json");
export const ALLOWLIST_PATH = path.join(ROOT, "allowlists", "recommended.apechain.json");
export const OPENSEA_OVERRIDES_PATH = path.join(ROOT, "allowlists", "opensea-slug-overrides.json");
export const EVENTS_PATH = path.join(STATE_DIR, "events.jsonl");
export const QUOTES_PATH = path.join(STATE_DIR, "quotes.json");
export const BRIDGE_REQUESTS_PATH = path.join(STATE_DIR, "bridge-requests.json");
export const CLAWBOTS_PATH = path.join(ROOT, "config", "clawbots.json");
export const CHAT_PATH = path.join(STATE_DIR, "chat.jsonl");

