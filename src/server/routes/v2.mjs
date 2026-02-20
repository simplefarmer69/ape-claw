/**
 * Routes: /api/v2/*
 */

import { createPublicClient, getContract, http as viemHttp, keccak256, toHex } from "viem";
import { ReceiptRegistry_ABI } from "../../lib/v2-onchain-abi.mjs";
import { getStorage } from "../storage/index.mjs";
import { resolveV2ReceiptReadConfig } from "./health.mjs";

const bigintReplacer = (_k, v) => (typeof v === "bigint" ? v.toString() : v);

export async function handleV2ReceiptGet(req, res, reqUrl) {
  const traceId = String(reqUrl.searchParams.get("traceId") || reqUrl.searchParams.get("trace") || "").trim();
  if (!traceId) {
    res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: false, error: "missing traceId" }));
  }
  const cfg = resolveV2ReceiptReadConfig();
  if (!cfg.ok) {
    res.writeHead(501, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: false, error: cfg.reason, inferredRpc: cfg.inferredRpc || false }));
  }
  try {
    const publicClient = createPublicClient({ transport: viemHttp(cfg.rpcUrl) });
    const receipts = getContract({ address: cfg.receiptsAddress, abi: ReceiptRegistry_ABI, client: { public: publicClient } });
    const traceIdHash = keccak256(toHex(traceId));
    const isRecorded = await receipts.read.isRecorded([traceIdHash]);
    const receipt = isRecorded ? await receipts.read.getReceipt([traceIdHash]) : null;
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: true, traceId, traceIdHash, isRecorded: Boolean(isRecorded), receipt }, bigintReplacer));
  } catch (err) {
    if (res.headersSent || res.writableEnded) return;
    res.writeHead(502, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: false, error: err?.message || "receipt read failed" }));
  }
}

export function handleV2Config(req, res) {
  const store = getStorage();
  const rec = store.resolveV2DeploymentRecord();
  const v2Cfg = resolveV2ReceiptReadConfig();
  res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  return res.end(JSON.stringify({
    ok: true, deployment: rec, receiptsRead: v2Cfg,
    podVault: rec?.podVault || null, agentAccount: rec?.agentAccount || null,
    record: rec, ts: new Date().toISOString(),
  }, bigintReplacer));
}
