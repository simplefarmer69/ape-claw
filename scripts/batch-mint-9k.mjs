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
const PROGRESS_PATH = path.join(process.cwd(), "state", "publish-progress-9k.json");

function loadProgress() {
  try { return JSON.parse(fs.readFileSync(PROGRESS_PATH, "utf8")); } catch { return { published: {}, errors: [] }; }
}
function saveProgress(prog) {
  fs.mkdirSync(path.dirname(PROGRESS_PATH), { recursive: true });
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(prog, null, 2));
}

function coerceRiskTier(sc) {
  const v = sc?.constraints?.riskTier;
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.min(255, Math.floor(v)));
  return 2;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const account = privateKeyToAccount(PK);
  const transport = http(RPC, { timeout: 60_000, retryCount: 3, retryDelay: 2_000 });
  const publicClient = createPublicClient({ transport });
  const walletClient = createWalletClient({ transport, account, chain: { id: 33139, name: "apechain" } });

  console.log(`Deployer : ${account.address}`);
  console.log(`SkillNFT : ${SKILL_NFT}`);
  console.log(`Registry : ${REGISTRY}`);
  console.log(`Progress : ${PROGRESS_PATH}`);

  const indexRaw = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
  const imported = indexRaw.imported || [];
  const items = imported.filter(it => it && it.ok !== false && it.fileName && it.slug);
  console.log(`Total imported skills: ${items.length}`);

  const progress = loadProgress();
  const alreadyDone = Object.keys(progress.published).length;
  if (alreadyDone > 0) console.log(`Resuming: ${alreadyDone} already published.`);

  const toPub = items.filter(it => !progress.published[it.slug] && !it.onchainTokenId);
  console.log(`Skills to mint: ${toPub.length}`);

  if (toPub.length === 0) {
    console.log("Nothing to mint. All skills already published.");
    return;
  }

  const startTime = Date.now();
  let published = 0;
  let errors = 0;
  const BATCH_SIZE = 1;
  const LOG_INTERVAL = 50;
  const MAX_ERRORS = 100;

  for (let i = 0; i < toPub.length; i++) {
    const item = toPub[i];
    const slug = item.slug;

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
    if (isStub) { published++; continue; }

    const versionHash = computeSkillVersionHash(sc.version);
    const contentHash = computeSkillcardContentHash(sc);
    const riskTier = coerceRiskTier(sc);
    const uri = `${URI_BASE}/${item.fileName}`;

    let retries = 0;
    const MAX_RETRIES = 3;

    while (retries <= MAX_RETRIES) {
      try {
        const mintHash = await walletClient.writeContract({
          address: SKILL_NFT,
          abi: SkillNFT_ABI,
          functionName: "mintSkill",
          args: [0n],
        });
        const mintReceipt = await publicClient.waitForTransactionReceipt({ hash: mintHash, timeout: 120_000 });

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
        await publicClient.waitForTransactionReceipt({ hash: pubHash, timeout: 120_000 });

        progress.published[slug] = {
          skillId: String(skillId),
          versionHash,
          contentHash,
          uri,
          riskTier,
          mintTx: mintHash,
          publishTx: pubHash,
        };
        published++;

        if (published % LOG_INTERVAL === 0 || published === toPub.length) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
          const rate = (published / (elapsed || 1)).toFixed(2);
          const eta = ((toPub.length - published) / (rate || 1) / 60).toFixed(1);
          console.log(
            `[${published}/${toPub.length}] ${slug} → skillId=${skillId} | ${elapsed}s elapsed | ${rate}/s | ETA ~${eta}m`
          );
        }

        if (published % 100 === 0) saveProgress(progress);
        break;

      } catch (e) {
        retries++;
        const msg = e.message?.slice(0, 150) || String(e);

        if (retries <= MAX_RETRIES) {
          console.log(`[RETRY ${retries}/${MAX_RETRIES}] ${slug}: ${msg}`);
          await sleep(2000 * retries);
        } else {
          errors++;
          progress.errors = progress.errors || [];
          progress.errors.push({ slug, error: msg, at: new Date().toISOString() });
          console.error(`[ERROR] ${slug}: ${msg}`);

          if (errors > MAX_ERRORS) {
            console.error(`Too many errors (${errors}), stopping.`);
            saveProgress(progress);
            process.exit(1);
          }
          break;
        }
      }
    }
  }

  saveProgress(progress);

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Done in ${elapsed} minutes.`);
  console.log(`Published: ${published}, Errors: ${errors}`);
  console.log(`Total on-chain: ${Object.keys(progress.published).length + alreadyDone}`);

  await updateIndex(progress);
}

async function updateIndex(progress) {
  console.log("\nUpdating index.json with on-chain data...");
  const indexRaw = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
  let updated = 0;
  for (const item of indexRaw.imported || []) {
    const pub = progress.published[item.slug];
    if (pub && !item.onchainTokenId) {
      item.onchainTokenId = pub.skillId;
      item.onchainMintTx = pub.mintTx;
      item.onchainPublishTx = pub.publishTx;
      item.onchainUri = pub.uri;
      updated++;
    }
  }
  fs.writeFileSync(INDEX_PATH, JSON.stringify(indexRaw, null, 2));
  console.log(`Updated ${updated} entries in index.json with on-chain data.`);

  const mergedImported = indexRaw.imported || [];
  const total = mergedImported.length + 8;
  const vettedCount = mergedImported.filter(it => it.vettedOk).length + 8;
  const onchainCount = mergedImported.filter(it => it.onchainTokenId).length + 8;

  const statsObj = {
    ok: true, total, seed: 8, imported: mergedImported.length, user: 0,
    vetted: vettedCount, onchain: onchainCount,
    recent: mergedImported.slice(-10).map(it => ({
      name: it.name, slug: it.slug, source: it.source, importedAt: it.hashes ? new Date().toISOString() : "",
    })),
  };
  fs.writeFileSync(path.join(process.cwd(), "data", "skills-stats.json"), JSON.stringify(statsObj, null, 2));
  console.log(`Updated stats: total=${total}, onchain=${onchainCount}`);

  const searchResults = mergedImported.map(it => ({
    name: it.name || "", slug: it.slug || "",
    description: (it.description || "").slice(0, 300),
    source: it.source || "imported", vettedOk: it.vettedOk !== false,
    importOk: it.importOk !== false, riskTier: it.riskTier != null ? it.riskTier : 2,
    sourceUrl: it.sourceUrl || null,
    provenance: { publisher: "apeclaw-importer", signed: false },
    onchainTokenId: it.onchainTokenId || null, fileName: it.fileName || null,
    onchainMintTx: it.onchainMintTx || null, onchainPublishTx: it.onchainPublishTx || null,
  }));

  const seedDir = path.join(process.cwd(), "skillcards", "seed");
  try {
    for (const sf of fs.readdirSync(seedDir).filter(f => f.endsWith(".json"))) {
      const sc = JSON.parse(fs.readFileSync(path.join(seedDir, sf), "utf8"));
      searchResults.unshift({
        name: sc.name || "", slug: sc.slug || "",
        description: (sc.description || "").slice(0, 300),
        source: "seed", vettedOk: true, importOk: true,
        riskTier: sc.constraints?.riskTier ?? 2,
        sourceUrl: sc.provenance?.sourceUrl || null,
        provenance: { publisher: "apeclaw", signed: true },
        onchainTokenId: null, fileName: sf,
        onchainMintTx: null, onchainPublishTx: null,
      });
    }
  } catch {}

  fs.writeFileSync(
    path.join(process.cwd(), "data", "skills-search.json"),
    JSON.stringify({ ok: true, total: searchResults.length, page: 1, limit: 50000, pages: 1, results: searchResults })
  );
  console.log(`Updated skills-search.json (${searchResults.length} results)`);
}

main().catch(e => { console.error(e); process.exit(1); });
