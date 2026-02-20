import fs from "node:fs";
import { EVENTS_PATH, CHAT_PATH, POLICY_PATH, ALLOWLIST_PATH, CLAWBOTS_PATH, INVITES_PATH } from "../../lib/paths.mjs";
import { getStorage } from "../storage/index.mjs";
import { getRegistrationKey, getMoltbookAppKey, getMoltbookApiBase } from "../middleware/auth.mjs";

const PORT = Number(process.env.APE_CLAW_UI_PORT || 8787);
const ROOT = (await import("../../lib/paths.mjs")).ROOT;
const OPEN_REGISTRATION = /^(1|true|yes|on)$/i.test(String(process.env.APE_CLAW_OPEN_REGISTRATION || "").trim());
const REGISTRATION_COOLDOWN_MS = Math.max(0, Number(process.env.APE_CLAW_REGISTRATION_COOLDOWN_MS || 10000));
const INVITE_TTL_MS = Math.max(60_000, Number(process.env.APE_CLAW_INVITE_TTL_MS || 24 * 60 * 60 * 1000));
const INVITE_MAX_USES = Math.max(1, Number(process.env.APE_CLAW_INVITE_MAX_USES || 5));

function resolveV2ReceiptReadConfig() {
  const store = getStorage();
  const fromEnvRpc = String(process.env.APE_CLAW_V2_RPC_URL || process.env.RPC_URL_33139 || "").trim();
  const fromEnvReceipts = String(process.env.APE_CLAW_V2_RECEIPT_REGISTRY || "").trim();
  const rec = store.resolveV2DeploymentRecord();
  const receiptsAddress = fromEnvReceipts || String(rec?.receipts || "").trim();
  let rpcUrl = fromEnvRpc;
  let inferredRpc = false;
  if (!rpcUrl && rec && Number(rec.chainId) === 31337) {
    rpcUrl = "http://127.0.0.1:8545";
    inferredRpc = true;
  }
  if (!rpcUrl || !receiptsAddress) {
    return { ok: false, rpcUrl: rpcUrl || "", receiptsAddress: receiptsAddress || "", inferredRpc, reason: "missing v2 config" };
  }
  return { ok: true, rpcUrl, receiptsAddress, inferredRpc };
}

export { resolveV2ReceiptReadConfig };

export function handleHealth(req, res) {
  const store = getStorage();
  const v2Cfg = resolveV2ReceiptReadConfig();
  const skillcardsUserIndexPath = store.SKILLCARDS_USER_DIR
    ? `${store.SKILLCARDS_USER_DIR}/index.json`
    : "";
  const payload = {
    ok: true,
    service: "ape-claw-telemetry",
    port: PORT,
    root: ROOT,
    paths: {
      events: EVENTS_PATH, chat: CHAT_PATH, policy: POLICY_PATH,
      allowlist: ALLOWLIST_PATH, clawbots: CLAWBOTS_PATH, invites: INVITES_PATH,
      skillcardsUserIndex: skillcardsUserIndexPath,
    },
    counts: {
      eventsBytes: fs.existsSync(EVENTS_PATH) ? fs.statSync(EVENTS_PATH).size : 0,
      chatBytes: fs.existsSync(CHAT_PATH) ? fs.statSync(CHAT_PATH).size : 0,
    },
    identity: {
      moltbookEnabled: Boolean(getMoltbookAppKey()),
      moltbookApiBase: getMoltbookApiBase(),
      registrationEnabled: Boolean(getRegistrationKey()),
      openRegistration: OPEN_REGISTRATION,
      registrationCooldownMs: REGISTRATION_COOLDOWN_MS,
      inviteTtlMs: INVITE_TTL_MS,
      inviteMaxUses: INVITE_MAX_USES,
    },
    v2: {
      rpcUrl: v2Cfg.ok ? v2Cfg.rpcUrl : (v2Cfg.rpcUrl || null),
      receiptRegistry: v2Cfg.ok ? v2Cfg.receiptsAddress : (v2Cfg.receiptsAddress || null),
      inferredRpc: Boolean(v2Cfg.inferredRpc),
      configured: Boolean(v2Cfg.ok),
    },
    ts: new Date().toISOString(),
  };
  res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  return res.end(JSON.stringify(payload));
}
