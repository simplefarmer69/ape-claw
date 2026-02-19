#!/usr/bin/env node
/**
 * Verify all deployed ApeClaw v2 contracts on ApeScan (ApeChain, chain ID 33139).
 * Uses the Etherscan V2 API with standard-json-input format.
 *
 * Usage: ETHERSCAN_API_KEY=<key> node scripts/verify-all-contracts.mjs
 *
 * Get a free key at https://etherscan.io/register
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function loadEnv() {
  try {
    const p = path.join(ROOT, ".env");
    if (!fs.existsSync(p)) return;
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const s = line.trim();
      if (!s || s.startsWith("#")) continue;
      const eq = s.indexOf("=");
      if (eq < 1) continue;
      const k = s.slice(0, eq).trim();
      let v = s.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
        v = v.slice(1, -1);
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {}
}
loadEnv();

const API_KEY = process.env.ETHERSCAN_API_KEY || "";
const CHAIN_ID = 33139;
const API_URL = `https://api.etherscan.io/v2/api?chainid=${CHAIN_ID}`;

const deployments = JSON.parse(
  fs.readFileSync(path.join(ROOT, "state", "v2-deployments", "apechain.json"), "utf8")
);

const buildInfoDir = path.join(ROOT, "contracts-artifacts", "build-info");
const buildInfoFiles = fs.readdirSync(buildInfoDir).filter(f => f.endsWith(".json") && !f.includes(".output."));
if (!buildInfoFiles.length) throw new Error("No build-info found. Run: npx hardhat compile");
const buildInfo = JSON.parse(fs.readFileSync(path.join(buildInfoDir, buildInfoFiles[0]), "utf8"));
const solcVersion = buildInfo.solcLongVersion;
const standardJsonInput = JSON.stringify(buildInfo.input);

const deployer = deployments.deployer;

function pad32(hex) {
  return hex.replace(/^0x/i, "").toLowerCase().padStart(64, "0");
}

function encodeAddress(addr) {
  return pad32(addr);
}

function encodeUint256(val) {
  return BigInt(val).toString(16).padStart(64, "0");
}

function encodeAddressArray(addrs) {
  let out = encodeUint256(addrs.length);
  for (const a of addrs) out += encodeAddress(a);
  return out;
}

function encodeUint256Array(vals) {
  let out = encodeUint256(vals.length);
  for (const v of vals) out += encodeUint256(v);
  return out;
}

function buildConstructorArgs_SkillRegistry() {
  return encodeAddress(deployments.skillNft);
}

function buildConstructorArgs_PolicyEngine() {
  return encodeAddress(deployer);
}

function buildConstructorArgs_AgentAccount() {
  return encodeAddress(deployer) + encodeAddress(deployments.policy) + encodeAddress(deployments.receipts);
}

function buildConstructorArgs_PodVault() {
  const addressArrayOffset = encodeUint256(64);
  const uint256ArrayOffset = encodeUint256(128);
  const addrArray = encodeAddressArray([deployer]);
  const uintArray = encodeUint256Array([10000n]);
  return addressArrayOffset + uint256ArrayOffset + addrArray + uintArray;
}

const contracts = [
  { name: "SkillNFT", address: deployments.skillNft, source: "contracts/SkillNFT.sol", contract: "SkillNFT", args: "" },
  { name: "SkillRegistry", address: deployments.registry, source: "contracts/SkillRegistry.sol", contract: "SkillRegistry", args: buildConstructorArgs_SkillRegistry() },
  { name: "IntentRegistry", address: deployments.intents, source: "contracts/IntentRegistry.sol", contract: "IntentRegistry", args: "" },
  { name: "ReceiptRegistry", address: deployments.receipts, source: "contracts/ReceiptRegistry.sol", contract: "ReceiptRegistry", args: "" },
  { name: "PolicyEngine", address: deployments.policy, source: "contracts/PolicyEngine.sol", contract: "PolicyEngine", args: buildConstructorArgs_PolicyEngine() },
  { name: "AgentAccount", address: deployments.agentAccount, source: "contracts/AgentAccount.sol", contract: "AgentAccount", args: buildConstructorArgs_AgentAccount() },
  { name: "PodVault", address: deployments.podVault, source: "contracts/PodVault.sol", contract: "PodVault", args: buildConstructorArgs_PodVault() },
  { name: "SwapModule", address: deployments.modules.swap, source: "contracts/SwapModule.sol", contract: "SwapModule", args: "" },
  { name: "BridgeModule", address: deployments.modules.bridge, source: "contracts/BridgeModule.sol", contract: "BridgeModule", args: "" },
  { name: "NftBuyModule", address: deployments.modules.nftBuy, source: "contracts/NftBuyModule.sol", contract: "NftBuyModule", args: "" },
];

async function submitVerification(c) {
  const contractFullName = `${c.source}:${c.contract}`;
  const body = new URLSearchParams({
    apikey: API_KEY,
    module: "contract",
    action: "verifysourcecode",
    contractaddress: c.address,
    sourceCode: standardJsonInput,
    codeformat: "solidity-standard-json-input",
    contractname: contractFullName,
    compilerversion: `v${solcVersion}`,
    constructorArguements: c.args,
  });

  const resp = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  return resp.json();
}

async function checkStatus(guid) {
  const url = `${API_URL}&module=contract&action=checkverifystatus&guid=${encodeURIComponent(guid)}&apikey=${encodeURIComponent(API_KEY)}`;
  const resp = await fetch(url);
  return resp.json();
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function verify(c) {
  console.log(`\n[${c.name}] ${c.address}`);
  console.log(`  Source: ${c.source}:${c.contract}`);
  if (c.args) console.log(`  Constructor args: ${c.args.slice(0, 40)}...`);

  const result = await submitVerification(c);

  if (result.status === "0") {
    const msg = String(result.result || "");
    if (msg.includes("Already Verified")) {
      console.log(`  ✓ Already verified`);
      return "already-verified";
    }
    console.log(`  ✗ Failed: ${msg}`);
    return "failed";
  }

  const guid = result.result;
  console.log(`  GUID: ${guid} — polling...`);

  for (let i = 0; i < 30; i++) {
    await sleep(5000);
    const check = await checkStatus(guid);
    if (String(check.result || "").includes("Pending")) {
      process.stdout.write(".");
      continue;
    }
    if (check.status === "1") {
      console.log(`\n  ✓ Verified!`);
      return "verified";
    }
    console.log(`\n  ✗ ${check.result}`);
    return "failed";
  }
  console.log(`\n  ✗ Timed out`);
  return "timeout";
}

async function main() {
  if (!API_KEY) {
    console.error("ERROR: ETHERSCAN_API_KEY not set.");
    console.error("Get a free key at: https://etherscan.io/register");
    console.error("Then add to .env:  ETHERSCAN_API_KEY=<your-key>");
    process.exit(1);
  }

  console.log(`Verifying ${contracts.length} contracts on ApeChain (${CHAIN_ID})`);
  console.log(`Compiler: solc ${solcVersion}`);
  console.log(`Deployer: ${deployer}`);
  console.log(`API: Etherscan V2`);

  const results = [];
  for (const c of contracts) {
    const status = await verify(c);
    results.push({ name: c.name, status });
    await sleep(1200);
  }

  console.log("\n\n=== Summary ===");
  let ok = 0;
  for (const r of results) {
    const icon = r.status === "verified" || r.status === "already-verified" ? "✓" : "✗";
    if (icon === "✓") ok++;
    console.log(`  ${icon} ${r.name}: ${r.status}`);
  }
  console.log(`\n${ok}/${results.length} verified.`);
}

main().catch(err => { console.error(err); process.exitCode = 1; });
