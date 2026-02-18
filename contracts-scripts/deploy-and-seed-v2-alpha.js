import fs from "node:fs";
import path from "node:path";
import hre from "hardhat";
import {
  computeSkillcardContentHash,
  computeSkillVersionHash,
  readSkillcardJson,
} from "../src/lib/v2-skillcard.mjs";

function coerceRiskTier(skillcard) {
  const v = skillcard?.constraints?.riskTier;
  if (typeof v === "number" && Number.isFinite(v)) {
    const n = Math.max(0, Math.min(255, Math.floor(v)));
    return n;
  }
  // Back-compat: allow string labels.
  if (typeof v === "string") {
    const s = v.toLowerCase().trim();
    if (s === "high") return 3;
    if (s === "medium" || s === "med") return 2;
    if (s === "low") return 1;
    if (s === "unknown") return 0;
  }
  return 1;
}

function seedUriForFile(filePath, fileName) {
  const base = String(process.env.APECLAW_SKILLCARD_URI_BASE || "").trim();
  if (base) return base.replace(/\/+$/, "") + "/" + String(fileName).replace(/^\/+/, "");
  return `file://${filePath}`;
}

async function main() {
  const netName = String(hre.network.name || "unknown").trim();
  if (netName === "apechain") {
    const rpc = String(process.env.APE_CLAW_V2_RPC_URL || process.env.RPC_URL_33139 || "").trim();
    const pk = String(process.env.APE_CLAW_V2_PRIVATE_KEY || "").trim();
    if (!rpc) throw new Error("Missing ApeChain RPC. Set APE_CLAW_V2_RPC_URL (or RPC_URL_33139).");
    if (!pk) throw new Error("Missing deploy key. Set APE_CLAW_V2_PRIVATE_KEY.");
  }
  const { viem } = await hre.network.connect();
  const publicClient = await viem.getPublicClient();

  console.log("[v2-alpha] Deploying SkillNFT...");
  const skillNft = await viem.deployContract("SkillNFT");
  console.log("[v2-alpha] SkillNFT:", skillNft.address);

  console.log("[v2-alpha] Deploying SkillRegistry...");
  const registry = await viem.deployContract("SkillRegistry", [skillNft.address]);
  console.log("[v2-alpha] SkillRegistry:", registry.address);

  console.log("[v2-alpha] Deploying IntentRegistry...");
  const intents = await viem.deployContract("IntentRegistry");
  console.log("[v2-alpha] IntentRegistry:", intents.address);

  console.log("[v2-alpha] Deploying ReceiptRegistry...");
  const receipts = await viem.deployContract("ReceiptRegistry");
  console.log("[v2-alpha] ReceiptRegistry:", receipts.address);

  console.log("[v2-alpha] Deploying PolicyEngine...");
  const policy = await viem.deployContract("PolicyEngine", [(await viem.getWalletClients())[0].account.address]);
  console.log("[v2-alpha] PolicyEngine:", policy.address);

  console.log("[v2-alpha] Deploying AgentAccount...");
  const agent = await viem.deployContract("AgentAccount", [(await viem.getWalletClients())[0].account.address, policy.address, receipts.address]);
  console.log("[v2-alpha] AgentAccount:", agent.address);

  console.log("[v2-alpha] Deploying module skills (Swap/Bridge/NFT Buy)...");
  const swapModule = await viem.deployContract("SwapModule");
  const bridgeModule = await viem.deployContract("BridgeModule");
  const nftBuyModule = await viem.deployContract("NftBuyModule");
  console.log("[v2-alpha] SwapModule:", swapModule.address);
  console.log("[v2-alpha] BridgeModule:", bridgeModule.address);
  console.log("[v2-alpha] NftBuyModule:", nftBuyModule.address);

  // ── Phase 0a: Deploy PodVault ──
  const deployer = (await viem.getWalletClients())[0].account.address;
  console.log("[v2-alpha] Deploying PodVault (sole member = deployer)...");
  const podVault = await viem.deployContract("PodVault", [
    [deployer],
    [10000n],
  ]);
  console.log("[v2-alpha] PodVault:", podVault.address);

  // ── Phase 0b: Configure PolicyEngine ──
  console.log("[v2-alpha] Configuring PolicyEngine...");
  const { parseEther } = await import("viem");
  await policy.write.setMaxValuePerTx([parseEther("1")]);
  console.log("[v2-alpha]   maxValuePerTx = 1 ETH");

  await policy.write.setModuleAllowed([swapModule.address, true]);
  await policy.write.setModuleAllowed([bridgeModule.address, true]);
  await policy.write.setModuleAllowed([nftBuyModule.address, true]);
  console.log("[v2-alpha]   Allowlisted 3 modules (Swap, Bridge, NftBuy)");

  let mockTargetAddr = null;
  try {
    const mockTarget = await viem.deployContract("MockTarget");
    mockTargetAddr = mockTarget.address;
    await policy.write.setTargetAllowed([mockTarget.address, true]);
    const mockSelector = "0x12345678";
    await policy.write.setSelectorAllowed([mockTarget.address, mockSelector, true]);
    console.log("[v2-alpha]   MockTarget deployed + allowlisted:", mockTarget.address);
  } catch (e) {
    console.log("[v2-alpha]   MockTarget skipped (may not exist on this network):", e.message?.slice(0, 80));
  }

  // ── Phase 0c: Seed skills with PodVault royalty ──
  const seedDir = path.join(process.cwd(), "skillcards", "seed");
  const seedFiles = fs.existsSync(seedDir)
    ? fs.readdirSync(seedDir).filter((f) => f.endsWith(".json")).sort()
    : [];

  console.log(`[v2-alpha] Seeding ${seedFiles.length} skillcards (royalty → PodVault @ 5%)...`);

  for (const f of seedFiles) {
    const p = path.join(seedDir, f);
    const skillcard = readSkillcardJson(p);

    const mintTx = await skillNft.write.mintSkillWithRoyalty([0n, podVault.address, 500]);
    await publicClient.waitForTransactionReceipt({ hash: mintTx });
    const skillId = (await skillNft.read.nextSkillId()) - 1n;

    const versionHash = computeSkillVersionHash(skillcard.version);
    const contentHash = computeSkillcardContentHash(skillcard);
    const uri = seedUriForFile(p, f);
    const riskTier = coerceRiskTier(skillcard);

    const pubTx = await registry.write.publishVersion([
      skillId,
      versionHash,
      contentHash,
      uri,
      riskTier,
    ]);
    await publicClient.waitForTransactionReceipt({ hash: pubTx });

    console.log(
      `[v2-alpha] Published ${skillcard.slug || f} as skillId=${skillId} versionHash=${versionHash} contentHash=${contentHash}`,
    );
  }

  console.log("[v2-alpha] Done.");
  const out = {
    skillNft: skillNft.address,
    registry: registry.address,
    intents: intents.address,
    receipts: receipts.address,
    policy: policy.address,
    agentAccount: agent.address,
    podVault: podVault.address,
    modules: {
      swap: swapModule.address,
      bridge: bridgeModule.address,
      nftBuy: nftBuyModule.address,
    },
    mockTarget: mockTargetAddr,
    seeded: seedFiles.length,
    network: netName,
    chainId: Number(await publicClient.getChainId()),
    policyConfig: {
      maxValuePerTx: "1000000000000000000",
      allowlistedModules: [swapModule.address, bridgeModule.address, nftBuyModule.address],
    },
    royaltyReceiver: podVault.address,
    royaltyBps: 500,
  };

  try {
    const outDir = path.join(process.cwd(), "state", "v2-deployments");
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, `${netName}.json`), JSON.stringify(out, null, 2));
  } catch {}

  console.log(JSON.stringify(out, null, 2));

  console.log("");
  console.log("[v2-alpha] Export these env vars:");
  console.log(`export APE_CLAW_V2_SKILL_NFT=${out.skillNft}`);
  console.log(`export APE_CLAW_V2_SKILL_REGISTRY=${out.registry}`);
  console.log(`export APE_CLAW_V2_INTENT_REGISTRY=${out.intents}`);
  console.log(`export APE_CLAW_V2_RECEIPT_REGISTRY=${out.receipts}`);
  console.log(`export APE_CLAW_V2_POLICY_ENGINE=${out.policy}`);
  console.log(`export APE_CLAW_V2_AGENT_ACCOUNT=${out.agentAccount}`);
  console.log(`export APE_CLAW_V2_POD_VAULT=${out.podVault}`);
  console.log(`export APE_CLAW_V2_SWAP_MODULE=${out.modules.swap}`);
  console.log(`export APE_CLAW_V2_BRIDGE_MODULE=${out.modules.bridge}`);
  console.log(`export APE_CLAW_V2_NFT_BUY_MODULE=${out.modules.nftBuy}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

