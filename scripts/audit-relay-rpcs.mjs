import fs from "node:fs";
import path from "node:path";

const RELAY_CHAINS_URL = "https://api.relay.link/chains";
const TIMEOUT_MS = Number(process.env.RELAY_RPC_AUDIT_TIMEOUT_MS || 7000);
const OUTPUT_PATH = path.join(process.cwd(), "research", "relay_rpc_audit.json");

function timeoutSignal(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

async function fetchJson(url, init = {}) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function auditChain(chain) {
  const id = Number(chain.id);
  const name = String(chain.name || "");
  const rpc = String(chain.httpRpcUrl || "");
  const vmType = String(chain.vmType || "").toLowerCase();
  if (!rpc) return { id, name, vmType, ok: false, reason: "missing rpc" };

  try {
    if (vmType === "evm") {
      const payload = { jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] };
      const t = timeoutSignal(TIMEOUT_MS);
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: t.signal,
      });
      t.clear();
      if (!res.ok) return { id, name, vmType, ok: false, reason: `HTTP ${res.status}` };
      const data = await res.json();
      if (data?.error || !data?.result) return { id, name, vmType, ok: false, reason: "rpc error" };
      const rpcChainId = parseInt(data.result, 16);
      return {
        id,
        name,
        vmType,
        ok: rpcChainId === id,
        rpcChainId,
        reason: rpcChainId === id ? "ok" : `chainId mismatch rpc=${rpcChainId}`,
      };
    }

    // Non-EVM endpoints vary; basic reachability check.
    const t = timeoutSignal(TIMEOUT_MS);
    const res = await fetch(rpc, { method: "GET", signal: t.signal });
    t.clear();
    if (!res.ok) return { id, name, vmType, ok: false, reason: `HTTP ${res.status}` };
    return { id, name, vmType, ok: true, reason: "reachable" };
  } catch (err) {
    return { id, name, vmType, ok: false, reason: err.message || "request failed" };
  }
}

async function main() {
  const data = await fetchJson(RELAY_CHAINS_URL);
  const chains = Array.isArray(data?.chains) ? data.chains : [];
  const results = [];
  for (const c of chains) {
    // serial to avoid hammering public endpoints
    // eslint-disable-next-line no-await-in-loop
    results.push(await auditChain(c));
  }

  const ok = results.filter((r) => r.ok).length;
  const fail = results.length - ok;
  const report = {
    source: RELAY_CHAINS_URL,
    auditedAt: new Date().toISOString(),
    timeoutMs: TIMEOUT_MS,
    total: results.length,
    ok,
    fail,
    results: results.sort((a, b) => a.id - b.id),
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  console.log(
    JSON.stringify(
      {
        output: OUTPUT_PATH,
        total: report.total,
        ok: report.ok,
        fail: report.fail,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err.message || String(err));
  process.exit(1);
});

