import { createWalletClient, defineChain, encodeFunctionData, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SeaportABI } from "@opensea/seaport-js/lib/abi/Seaport.js";

const OPENSEA_API_BASE = "https://api.opensea.io/api/v2";

function toHexPrivateKey(pk) {
  const raw = String(pk || "").trim();
  if (!raw) return "";
  return raw.startsWith("0x") ? raw : `0x${raw}`;
}

function functionNameFromSignature(sig) {
  const raw = String(sig || "").split("(")[0];
  if (raw === "fulfillBasicOrder_efficient_6GL6yc") return "fulfillBasicOrder";
  return raw;
}

function buildParams(functionName, inputData = {}) {
  if (functionName === "fulfillAdvancedOrder" && "advancedOrder" in inputData) {
    return [
      inputData.advancedOrder,
      inputData.criteriaResolvers || [],
      inputData.fulfillerConduitKey ||
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      inputData.recipient,
    ];
  }
  if (functionName === "fulfillBasicOrder" && "basicOrderParameters" in inputData) {
    return [inputData.basicOrderParameters];
  }
  if (functionName === "fulfillOrder" && "order" in inputData) {
    return [
      inputData.order,
      inputData.fulfillerConduitKey ||
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      inputData.recipient,
    ];
  }
  return Object.values(inputData);
}

async function fetchJson(url, init = {}) {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenSea HTTP ${res.status}${body ? `: ${body.slice(0, 220)}` : ""}`);
  }
  return res.json();
}

function openseaChainSlug(chainId) {
  const id = Number(chainId);
  if (id === 33139) return "ape_chain";
  if (id === 1) return "ethereum";
  if (id === 8453) return "base";
  if (id === 42161) return "arbitrum";
  throw new Error(`Unsupported OpenSea chainId for fulfillment: ${chainId}`);
}

export async function getListingFulfillmentData({
  apiKey,
  orderHash,
  protocolAddress,
  chainId,
  fulfillerAddress,
  privateKey,
  assetContractAddress,
  tokenId,
  includeOptionalCreatorFees = false,
}) {
  if (!apiKey) throw new Error("Missing OPENSEA_API_KEY for live fulfillment.");
  if (!orderHash) throw new Error("Missing order hash for fulfillment.");
  const resolvedFulfiller =
    fulfillerAddress || (privateKey ? privateKeyToAccount(toHexPrivateKey(privateKey)).address : "");
  if (!resolvedFulfiller) throw new Error("Missing fulfiller address for fulfillment.");

  const payload = {
    listing: {
      hash: orderHash,
      chain: openseaChainSlug(chainId),
      protocol_address: protocolAddress,
    },
    fulfiller: {
      address: resolvedFulfiller,
    },
    units_to_fill: "1",
    include_optional_creator_fees: includeOptionalCreatorFees,
  };

  if (assetContractAddress && tokenId) {
    payload.consideration = {
      asset_contract_address: assetContractAddress,
      token_id: String(tokenId),
    };
  }

  const data = await fetchJson(`${OPENSEA_API_BASE}/listings/fulfillment_data`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": "ape-claw/0.1.0",
    },
    body: JSON.stringify(payload),
  });
  return data;
}

export async function executeListingFulfillmentTx({
  fulfillmentData,
  privateKey,
  rpcUrl,
}) {
  const hexPk = toHexPrivateKey(privateKey);
  if (!hexPk) throw new Error("Missing APE_CLAW_PRIVATE_KEY for live nft execute.");
  const tx = fulfillmentData?.fulfillment_data?.transaction;
  if (!tx) throw new Error("OpenSea fulfillment data missing transaction object.");
  const fn = functionNameFromSignature(tx.function);
  const params = buildParams(fn, tx.input_data || {});
  const calldata = encodeFunctionData({
    abi: SeaportABI,
    functionName: fn,
    args: params,
  });

  const chainId = Number(tx.chain);
  const nativeCurrency = chainId === 33139
    ? { name: "ApeCoin", symbol: "APE", decimals: 18 }
    : { name: "Ether", symbol: "ETH", decimals: 18 };
  const chain = defineChain({
    id: chainId,
    name: `chain-${chainId}`,
    nativeCurrency,
    rpcUrls: { default: { http: [rpcUrl] } },
  });
  const account = privateKeyToAccount(hexPk);
  const client = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });

  const hash = await client.sendTransaction({
    to: tx.to,
    data: calldata,
    value: BigInt(tx.value || "0"),
    chain,
  });

  return {
    txHash: hash,
    chainId,
    to: tx.to,
    functionName: fn,
  };
}

