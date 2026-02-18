import fs from "node:fs";
import path from "node:path";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  computeSkillcardContentHash,
  computeSkillVersionHash,
  readSkillcardJson,
} from "../src/lib/v2-skillcard.mjs";
import { SkillNFT_ABI, SkillRegistry_ABI } from "../src/lib/v2-onchain-abi.mjs";

function loadEnv() {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), ".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const s = line.trim();
      if (!s || s.startsWith("#")) continue;
      const eq = s.indexOf("=");
      if (eq < 1) continue;
      const k = s.slice(0, eq).trim();
      let v = s.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
        v = v.slice(1, -1);
      if (process.env[k] === undefined) process.env[k] = v;
    }
  } catch {}
}
loadEnv();

const RPC = process.env.APE_CLAW_V2_RPC_URL;
const PK = process.env.APE_CLAW_V2_PRIVATE_KEY;
const SKILL_NFT = process.env.APE_CLAW_V2_SKILL_NFT;
const REGISTRY = process.env.APE_CLAW_V2_SKILL_REGISTRY;

if (!RPC || !PK || !SKILL_NFT || !REGISTRY) {
  console.error("Missing env: APE_CLAW_V2_RPC_URL, APE_CLAW_V2_PRIVATE_KEY, APE_CLAW_V2_SKILL_NFT, APE_CLAW_V2_SKILL_REGISTRY");
  process.exit(1);
}

const URI_BASE = "https://api.apeclaw.ai/skillcards/imported";
const IMPORTED_DIR = path.join(process.cwd(), "skillcards", "imported");
const INDEX_PATH = path.join(IMPORTED_DIR, "index.json");
const PROGRESS_PATH = path.join(process.cwd(), "state", "publish-progress.json");

function loadProgress() {
  try { return JSON.parse(fs.readFileSync(PROGRESS_PATH, "utf8")); } catch { return { published: {} }; }
}
function saveProgress(prog) {
  fs.mkdirSync(path.dirname(PROGRESS_PATH), { recursive: true });
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(prog, null, 2));
}

function coerceRiskTier(sc) {
  const v = sc?.constraints?.riskTier;
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.min(255, Math.floor(v)));
  if (typeof v === "string") {
    const s = v.toLowerCase().trim();
    if (s === "high") return 3;
    if (s === "medium" || s === "med") return 2;
    if (s === "low") return 1;
  }
  return 2;
}

async function main() {
  const account = privateKeyToAccount(PK);
  const transport = http(RPC);
  const publicClient = createPublicClient({ transport });
  const walletClient = createWalletClient({ transport, account });

  console.log(`Deployer: ${account.address}`);
  console.log(`SkillNFT: ${SKILL_NFT}`);
  console.log(`Registry: ${REGISTRY}`);

  const indexRaw = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
  const imported = indexRaw.imported || indexRaw;
  const items = (Array.isArray(imported) ? imported : []).filter(
    (it) => it && it.ok !== false && it.fileName && it.slug
  );

  console.log(`Found ${items.length} imported skills to publish.`);

  const progress = loadProgress();
  const alreadyDone = Object.keys(progress.published).length;
  if (alreadyDone > 0) console.log(`Resuming: ${alreadyDone} already published.`);

  let count = 0;
  let errors = 0;
  const BATCH_LOG_INTERVAL = 25;

  for (const item of items) {
    const slug = item.slug;
    if (progress.published[slug]) { count++; continue; }

    const filePath = path.join(IMPORTED_DIR, item.fileName);
    let sc;
    try {
      sc = readSkillcardJson(filePath);
    } catch {
      console.log(`[SKIP] ${slug} — file not found: ${item.fileName}`);
      errors++;
      continue;
    }

    const isStub = sc?.constraints?.importedStub === true;
    if (isStub) { count++; continue; }

    const versionHash = computeSkillVersionHash(sc.version);
    const contentHash = computeSkillcardContentHash(sc);
    const riskTier = coerceRiskTier(sc);
    const uri = `${URI_BASE}/${item.fileName}`;

    try {
      const mintHash = await walletClient.writeContract({
        address: SKILL_NFT,
        abi: SkillNFT_ABI,
        functionName: "mintSkill",
        args: [0n],
      });
      await publicClient.waitForTransactionReceipt({ hash: mintHash });

      const nextId = await publicClient.readContract({
        address: SKILL_NFT,
        abi: SkillNFT_ABI,
        functionName: "nextSkillId",
        args: [],
      });
      const skillId = BigInt(nextId) - 1n;

      const pubHash = await walletClient.writeContract({
        address: REGISTRY,
        abi: SkillRegistry_ABI,
        functionName: "publishVersion",
        args: [skillId, versionHash, contentHash, uri, riskTier],
      });
      await publicClient.waitForTransactionReceipt({ hash: pubHash });

      progress.published[slug] = {
        skillId: String(skillId),
        versionHash,
        contentHash,
        uri,
        riskTier,
        mintTx: mintHash,
        publishTx: pubHash,
      };
      count++;
      saveProgress(progress);

      if (count % BATCH_LOG_INTERVAL === 0 || count === items.length) {
        console.log(`[${count}/${items.length}] Published ${slug} as skillId=${skillId}`);
      }
    } catch (e) {
      errors++;
      console.error(`[ERROR] ${slug}: ${e.message?.slice(0, 120)}`);
      if (errors > 10) {
        console.error("Too many errors, stopping.");
        break;
      }
    }
  }

  console.log(`\nDone. Published: ${Object.keys(progress.published).length}, Errors: ${errors}`);
  saveProgress(progress);
}

main().catch((e) => { console.error(e); process.exit(1); });
