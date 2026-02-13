const RELAY_API_BASE = process.env.RELAY_API_BASE || "https://api.relay.link";
let relayRpcMapCache = null;

function relayHeaders() {
  return { accept: "application/json" };
}

async function fetchJson(url, init = {}) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getRelayRpcMap() {
  if (relayRpcMapCache) return relayRpcMapCache;
  try {
    const data = await fetchJson(`${RELAY_API_BASE}/chains`, {
      method: "GET",
      headers: relayHeaders(),
    });
    const map = new Map();
    for (const chain of data?.chains || []) {
      const id = Number(chain?.id);
      const rpc = String(chain?.httpRpcUrl || "");
      if (Number.isFinite(id) && rpc) map.set(id, rpc);
    }
    relayRpcMapCache = map;
  } catch {
    relayRpcMapCache = new Map();
  }
  return relayRpcMapCache;
}

export async function resolveRpcUrl(chainId, policy = {}) {
  const direct = process.env[`RPC_URL_${chainId}`];
  if (direct) return direct;
  const policyRpc =
    Number(chainId) === Number(policy?.apechainChainId) ? String(policy?.apechainRpcUrl || "") : "";
  const isLocalPolicyRpc =
    policyRpc.startsWith("http://localhost") || policyRpc.startsWith("https://localhost") ||
    policyRpc.startsWith("http://127.0.0.1") || policyRpc.startsWith("https://127.0.0.1");
  if (policyRpc && !isLocalPolicyRpc) return policyRpc;
  const relayMap = await getRelayRpcMap();
  const relayRpc = relayMap.get(Number(chainId));
  if (relayRpc) return relayRpc;
  if (policyRpc) return policyRpc;
  throw new Error(`Missing RPC URL for chain ${chainId}. Set RPC_URL_${chainId}.`);
}

