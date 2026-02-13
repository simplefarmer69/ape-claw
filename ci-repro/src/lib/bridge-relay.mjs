import { createWalletClient, defineChain, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { resolveRpcUrl } from "./rpc.mjs";

const RELAY_API_BASE = process.env.RELAY_API_BASE || "https://api.relay.link";
const NATIVE_ADDRESS = "0x0000000000000000000000000000000000000000";

const CHAIN_ID_BY_NAME = {
  ethereum: 1,
  arbitrum: 42161,
  base: 8453,
  optimism: 10,
  polygon: 137,
  apechain: 33139,
};

function normalizeChainId(input) {
  if (typeof input === "number") return input;
  const s = String(input || "").toLowerCase().trim();
  if (/^\d+$/.test(s)) return Number(s);
  if (CHAIN_ID_BY_NAME[s]) return CHAIN_ID_BY_NAME[s];
  throw new Error(`Unsupported chain: ${input}`);
}

function toHexPrivateKey(pk) {
  const raw = String(pk || "").trim();
  if (!raw) return "";
  return raw.startsWith("0x") ? raw : `0x${raw}`;
}

function getAddressFromPrivateKey(privateKey) {
  const hex = toHexPrivateKey(privateKey);
  if (!hex) return "";
  return privateKeyToAccount(hex).address;
}

function normalizeCurrencyAddress(value) {
  if (!value) return NATIVE_ADDRESS;
  const s = String(value).trim();
  if (s.toUpperCase() === "NATIVE" || s.toUpperCase() === "ETH" || s.toUpperCase() === "APE") {
    return NATIVE_ADDRESS;
  }
  if (/^0x[a-fA-F0-9]{40}$/.test(s)) return s;
  throw new Error(`Invalid currency address: ${value}`);
}

function relayHeaders(apiKey) {
  const headers = {
    "content-type": "application/json",
    accept: "application/json",
  };
  if (apiKey) headers["x-api-key"] = apiKey;
  return headers;
}

async function fetchJson(url, init = {}) {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Relay HTTP ${res.status}${body ? `: ${body.slice(0, 220)}` : ""}`);
  }
  return res.json();
}

function guessRequestId(quote) {
  return (
    quote?.requestId ||
    quote?.steps?.[0]?.requestId ||
    quote?.steps?.[0]?.items?.[0]?.check?.requestId ||
    quote?.steps?.[0]?.items?.[0]?.metadata?.requestId ||
    ""
  );
}

function guessCheckEndpoint(quote) {
  return quote?.steps?.[0]?.items?.[0]?.check?.endpoint || "";
}

function guessAmountOut(quote) {
  const out = quote?.details?.currencyOut?.amount;
  if (typeof out === "string" && /^\d+$/.test(out)) return out;
  return null;
}

function computeFeeBps(quote) {
  const input = Number(quote?.details?.currencyIn?.amount || 0);
  if (!Number.isFinite(input) || input <= 0) return null;
  const relayer = Number(quote?.fees?.relayer?.amount || 0);
  const relayerGas = Number(quote?.fees?.relayerGas?.amount || 0);
  const app = Number(quote?.fees?.app?.amount || 0);
  const total = relayer + relayerGas + app;
  if (!Number.isFinite(total) || total < 0) return null;
  return Math.round((total / input) * 10000);
}

function findNumericByKeys(obj, keys) {
  if (!obj || typeof obj !== "object") return null;
  for (const [k, v] of Object.entries(obj)) {
    const lk = k.toLowerCase();
    if (keys.some((x) => lk.includes(x)) && Number.isFinite(Number(v))) {
      return Number(v);
    }
    if (v && typeof v === "object") {
      const nested = findNumericByKeys(v, keys);
      if (nested !== null) return nested;
    }
  }
  return null;
}

function nativeCurrencyForChain(chainId) {
  const id = Number(chainId);
  if (id === 33139) return { name: "ApeCoin", symbol: "APE", decimals: 18 };
  if (id === 137) return { name: "MATIC", symbol: "MATIC", decimals: 18 };
  return { name: "Ether", symbol: "ETH", decimals: 18 };
}

function makeChain(chainId, rpcUrl) {
  return defineChain({
    id: Number(chainId),
    name: `chain-${chainId}`,
    nativeCurrency: nativeCurrencyForChain(chainId),
    rpcUrls: { default: { http: [rpcUrl] } },
  });
}

function extractStatus(payload) {
  if (!payload || typeof payload !== "object") return "unknown";
  if (typeof payload.status === "string") return payload.status;
  if (typeof payload?.result?.status === "string") return payload.result.status;
  if (typeof payload?.data?.status === "string") return payload.data.status;
  if (Array.isArray(payload?.intents) && payload.intents[0]?.status) return payload.intents[0].status;
  if (Array.isArray(payload?.data) && payload.data[0]?.status) return payload.data[0].status;
  return "unknown";
}

function extractDestinationTxHash(payload) {
  return (
    payload?.destinationTxHash ||
    payload?.txHashes?.[0] ||
    payload?.result?.destinationTxHash ||
    payload?.result?.txHashes?.[0] ||
    payload?.data?.destinationTxHash ||
    payload?.data?.txHashes?.[0] ||
    payload?.intents?.[0]?.destinationTxHash ||
    payload?.intents?.[0]?.txHashes?.[0] ||
    payload?.data?.[0]?.destinationTxHash ||
    payload?.data?.[0]?.txHashes?.[0] ||
    null
  );
}

export function relayUserAddress({ args = {}, privateKey = "" }) {
  const byArg = String(args.user || "").trim();
  if (byArg) return byArg;
  const fromPk = getAddressFromPrivateKey(privateKey);
  if (fromPk) return fromPk;
  throw new Error("Missing user address. Pass --user <0x...> or set APE_CLAW_PRIVATE_KEY.");
}

export async function quoteBridgeRelay({
  from,
  to,
  token,
  amount,
  args = {},
  apiKey = "",
  privateKey = "",
}) {
  const originChainId = normalizeChainId(from);
  const destinationChainId = normalizeChainId(to);
  const user = relayUserAddress({ args, privateKey });
  const decimals = Number(args.decimals || 18);
  const amountBaseUnits = parseUnits(String(amount), decimals).toString();
  const originCurrency = normalizeCurrencyAddress(args.originCurrency || token);
  const destinationCurrency = normalizeCurrencyAddress(args.destinationCurrency || token);

  const body = {
    user,
    originChainId,
    destinationChainId,
    originCurrency,
    destinationCurrency,
    amount: amountBaseUnits,
    tradeType: "EXACT_INPUT",
  };

  const quote = await fetchJson(`${RELAY_API_BASE}/quote/v2`, {
    method: "POST",
    headers: relayHeaders(apiKey),
    body: JSON.stringify(body),
  });

  const relayRequestId = guessRequestId(quote);
  const checkEndpoint = guessCheckEndpoint(quote);
  const quotedFeeBps = computeFeeBps(quote) ?? findNumericByKeys(quote, ["feebps", "fee_bps", "bps"]);

  return {
    requestId: relayRequestId || `relay_${Date.now()}`,
    relayRequestId: relayRequestId || null,
    relayCheckEndpoint: checkEndpoint || null,
    from: String(from),
    to: String(to),
    token: String(token || "NATIVE"),
    amount: Number(amount),
    amountBaseUnits,
    originChainId,
    destinationChainId,
    originCurrency,
    destinationCurrency,
    status: "quoted",
    routeHash: relayRequestId || null,
    minAmountOut: guessAmountOut(quote),
    feeBps: Number.isFinite(quotedFeeBps) ? quotedFeeBps : null,
    expiresAt: new Date(Date.now() + 4 * 60_000).toISOString(),
    relayQuote: quote,
  };
}

export async function executeBridgeRelay({
  request,
  privateKey = "",
  policy = {},
}) {
  const hexPk = toHexPrivateKey(privateKey);
  if (!hexPk) throw new Error("Missing APE_CLAW_PRIVATE_KEY for live bridge execute.");
  const account = privateKeyToAccount(hexPk);
  const quote = request?.relayQuote;
  const steps = Array.isArray(quote?.steps) ? quote.steps : [];
  if (steps.length === 0) throw new Error("Relay quote has no executable steps.");

  const submittedTxs = [];
  for (const step of steps) {
    const item = step?.items?.[0];
    const kind = String(step?.kind || item?.kind || "").toLowerCase();
    if (!item) throw new Error("Relay step has no items.");
    if (kind !== "transaction") {
      throw new Error(`Unsupported relay step kind '${kind}'. Only transaction steps are supported.`);
    }
    const tx = item?.data || {};
    const chainId = Number(tx.chainId || request.originChainId);
    const rpcUrl = await resolveRpcUrl(chainId, policy);
    const chain = makeChain(chainId, rpcUrl);
    const client = createWalletClient({
      account,
      chain,
      transport: http(rpcUrl),
    });
    const hash = await client.sendTransaction({
      to: tx.to,
      data: tx.data || "0x",
      value: BigInt(tx.value || "0"),
      chain,
    });
    submittedTxs.push({ chainId, hash });
  }

  return {
    ...request,
    status: "pending",
    originTxHash: submittedTxs[0]?.hash || null,
    submittedTxs,
    submittedAt: new Date().toISOString(),
  };
}

export async function getBridgeRelayStatus({ request, apiKey = "" }) {
  const relayRequestId = request?.relayRequestId;
  if (!relayRequestId) {
    return { status: request?.status || "unknown", raw: null };
  }
  const check = String(request?.relayCheckEndpoint || "");
  const url = check
    ? (check.startsWith("http") ? check : `${RELAY_API_BASE}${check}`)
    : `${RELAY_API_BASE}/intents/status/v3?requestId=${encodeURIComponent(relayRequestId)}`;
  const raw = await fetchJson(url, {
    method: "GET",
    headers: relayHeaders(apiKey),
  });
  const relayStatus = extractStatus(raw);
  const normalized =
    relayStatus === "success"
      ? "confirmed"
      : relayStatus === "pending" || relayStatus === "waiting"
        ? "pending"
        : relayStatus;
  return {
    status: normalized,
    relayStatus,
    destinationTxHash: extractDestinationTxHash(raw),
    raw,
  };
}

