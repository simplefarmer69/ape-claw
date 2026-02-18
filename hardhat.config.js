import { defineConfig, configVariable } from "hardhat/config";
import hardhatViem from "@nomicfoundation/hardhat-viem";
import hardhatNodeTestRunner from "@nomicfoundation/hardhat-node-test-runner";
import fs from "node:fs";
import path from "node:path";

function loadDotEnvIfPresent() {
  // Load repo-local .env for non-interactive deploys (gitignored).
  // Keep it minimal and silent; never print env values.
  try {
    const p = path.join(process.cwd(), ".env");
    if (!fs.existsSync(p)) return;
    const raw = fs.readFileSync(p, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const s = line.trim();
      if (!s || s.startsWith("#")) continue;
      const eq = s.indexOf("=");
      if (eq < 1) continue;
      const k = s.slice(0, eq).trim();
      let v = s.slice(eq + 1).trim();
      if (!k) continue;
      // Strip optional wrapping quotes.
      if ((v.startsWith("\"") && v.endsWith("\"")) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (process.env[k] === undefined) process.env[k] = v;
    }
  } catch {}
}

loadDotEnvIfPresent();

// Convenience alias: allow existing env naming to work without duplicating values.
// (Hardhat validates HTTP network.url, so we keep configVariable() usage.)
if (process.env.APE_CLAW_V2_RPC_URL === undefined && String(process.env.RPC_URL_33139 || "").trim()) {
  process.env.APE_CLAW_V2_RPC_URL = String(process.env.RPC_URL_33139).trim();
}

export default defineConfig({
  plugins: [hardhatViem, hardhatNodeTestRunner],
  networks: {
    // For publish tests via scripts/import-skillcards.mjs (needs an HTTP RPC).
    // This is dev-only: the private key is the well-known default Hardhat node account.
    localhost: {
      type: "http",
      chainId: 31337,
      url: "http://127.0.0.1:8545",
      accounts: [
        String(process.env.APECLAW_LOCAL_DEPLOYER_PK || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80").trim(),
      ],
    },
    // Local dev (edr-simulated) remains the default when no network is specified.
    //
    // ApeChain mainnet target for v2-alpha deploy+seed.
    apechain: {
      type: "http",
      chainId: 33139,
      url: configVariable("APE_CLAW_V2_RPC_URL"),
      // Keep this v2-specific; do not silently reuse v1 execution keys.
      accounts: [configVariable("APE_CLAW_V2_PRIVATE_KEY")],
    },
  },
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./contracts-test",
    cache: "./contracts-cache",
    artifacts: "./contracts-artifacts",
  },
});

