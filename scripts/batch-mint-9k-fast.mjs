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
  console.error("Missing env vars");
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

const CONCURRENCY = 20;

async function main() {
  const account = privateKeyToAccount(PK);
  const transport = http(RPC, { timeout: 120_000, retryCount: 5, retryDelay: 1_000 });
  const publicClient = createPublicClient({ transport });
  const walletClient = createWalletClient({ transport, account, chain: { id: 33139, name: "apechain", nativeCurrency: { name: "APE", symbol: "APE", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } } });

  console.log(`Deployer : ${account.address}`);
  console.log(`SkillNFT : ${SKILL_NFT}`);
  console.log(`Registry : ${REGISTRY}`);
  console.log(`Concurrency: ${CONCURRENCY}`);

  const indexRaw = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
  const imported = indexRaw.imported || [];
  const items = imported.filter(it => it && it.ok !== false && it.fileName && it.slug);

  const progress = loadProgress();
  const alreadyDone = Object.keys(progress.published).length;
  console.log(`Already published: ${alreadyDone}`);

  const toPub = items.filter(it => !progress.published[it.slug] && !it.onchainTokenId);
  console.log(`Skills to mint: ${toPub.length}`);
  if (toPub.length === 0) { console.log("Nothing to mint."); return; }

  const prepared = [];
  for (const item of toPub) {
    const filePath = path.join(IMPORTED_DIR, item.fileName);
    let sc;
    try { sc = readSkillcardJson(filePath); } catch { continue; }
    if (sc?.constraints?.importedStub) continue;
    prepared.push({
      item,
      sc,
      versionHash: computeSkillVersionHash(sc.version),
      contentHash: computeSkillcardContentHash(sc),
      riskTier: coerceRiskTier(sc),
      uri: `${URI_BASE}/${item.fileName}`,
    });
  }
  console.log(`Prepared ${prepared.length} skills for minting.`);

  const startTime = Date.now();
  let published = 0;
  let errors = 0;
  let nonce = await publicClient.getTransactionCount({ address: account.address });
  console.log(`Starting nonce: ${nonce}`);

  const BATCH = CONCURRENCY;

  for (let batchStart = 0; batchStart < prepared.length; batchStart += BATCH) {
    const batch = prepared.slice(batchStart, batchStart + BATCH);
    const batchResults = [];

    const mintPromises = batch.map(async (entry, idx) => {
      const myNonce = nonce + idx;
      try {
        const mintHash = await walletClient.writeContract({
          address: SKILL_NFT,
          abi: SkillNFT_ABI,
          functionName: "mintSkill",
          args: [0n],
          nonce: myNonce,
        });
        return { ok: true, hash: mintHash, entry, nonce: myNonce };
      } catch (e) {
        return { ok: false, error: e.message?.slice(0, 150), entry, nonce: myNonce };
      }
    });

    const mintResults = await Promise.all(mintPromises);
    const successfulMints = mintResults.filter(r => r.ok);
    const failedMints = mintResults.filter(r => !r.ok);

    for (const f of failedMints) {
      errors++;
      console.error(`[MINT FAIL] ${f.entry.item.slug}: ${f.error}`);
    }

    nonce += batch.length;

    if (successfulMints.length === 0) {
      if (errors > 50) { console.error("Too many errors"); break; }
      nonce = await publicClient.getTransactionCount({ address: account.address });
      continue;
    }

    const mintReceipts = await Promise.all(
      successfulMints.map(async (m) => {
        try {
          const receipt = await publicClient.waitForTransactionReceipt({ hash: m.hash, timeout: 180_000 });
          return { ...m, receipt, receiptOk: receipt.status === "success" };
        } catch (e) {
          return { ...m, receiptOk: false, receiptError: e.message?.slice(0, 100) };
        }
      })
    );

    const confirmedMints = mintReceipts.filter(r => r.receiptOk);
    for (const f of mintReceipts.filter(r => !r.receiptOk)) {
      errors++;
      console.error(`[RECEIPT FAIL] ${f.entry.item.slug}: ${f.receiptError || "reverted"}`);
    }

    if (confirmedMints.length === 0) {
      nonce = await publicClient.getTransactionCount({ address: account.address });
      continue;
    }

    let currentNextId;
    try {
      currentNextId = await publicClient.readContract({
        address: SKILL_NFT, abi: SkillNFT_ABI,
        functionName: "nextSkillId", args: [],
      });
    } catch {
      await sleep(2000);
      currentNextId = await publicClient.readContract({
        address: SKILL_NFT, abi: SkillNFT_ABI,
        functionName: "nextSkillId", args: [],
      });
    }

    const latestSkillId = BigInt(currentNextId) - 1n;
    const firstSkillId = latestSkillId - BigInt(confirmedMints.length) + 1n;

    nonce = await publicClient.getTransactionCount({ address: account.address });

    const pubPromises = confirmedMints.map(async (m, idx) => {
      const skillId = firstSkillId + BigInt(idx);
      const myNonce = nonce + idx;
      try {
        const pubHash = await walletClient.writeContract({
          address: REGISTRY,
          abi: SkillRegistry_ABI,
          functionName: "publishVersion",
          args: [skillId, m.entry.versionHash, m.entry.contentHash, m.entry.uri, m.entry.riskTier],
          nonce: myNonce,
        });
        return { ok: true, hash: pubHash, skillId, entry: m.entry, mintTx: m.hash };
      } catch (e) {
        return { ok: false, error: e.message?.slice(0, 150), skillId, entry: m.entry, mintTx: m.hash };
      }
    });

    const pubResults = await Promise.all(pubPromises);
    nonce += confirmedMints.length;

    const successPubs = pubResults.filter(r => r.ok);
    for (const f of pubResults.filter(r => !r.ok)) {
      errors++;
      console.error(`[PUB FAIL] ${f.entry.item.slug} skillId=${f.skillId}: ${f.error}`);
    }

    if (successPubs.length > 0) {
      await Promise.all(
        successPubs.map(async (p) => {
          try {
            await publicClient.waitForTransactionReceipt({ hash: p.hash, timeout: 180_000 });
            progress.published[p.entry.item.slug] = {
              skillId: String(p.skillId),
              versionHash: p.entry.versionHash,
              contentHash: p.entry.contentHash,
              uri: p.entry.uri,
              riskTier: p.entry.riskTier,
              mintTx: p.mintTx,
              publishTx: p.hash,
            };
            published++;
          } catch (e) {
            errors++;
            console.error(`[PUB RECEIPT FAIL] ${p.entry.item.slug}: ${e.message?.slice(0, 100)}`);
          }
        })
      );
    }

    nonce = await publicClient.getTransactionCount({ address: account.address });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const rate = (published / (elapsed || 1)).toFixed(2);
    const remaining = prepared.length - batchStart - batch.length;
    const eta = remaining > 0 ? ((remaining / (parseFloat(rate) || 0.1)) / 60).toFixed(1) : "0";
    console.log(
      `[${published}/${prepared.length}] batch done | ${elapsed}s | ${rate}/s | ETA ~${eta}m | errs=${errors}`
    );

    if (published % 200 === 0 || batchStart + batch.length >= prepared.length) {
      saveProgress(progress);
    }

    if (errors > 200) {
      console.error("Too many errors, stopping.");
      break;
    }
  }

  saveProgress(progress);
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Done in ${elapsed} minutes. Published: ${published}, Errors: ${errors}`);
  console.log(`Total on-chain: ${Object.keys(progress.published).length}`);

  await updateIndex(progress);
}

async function updateIndex(progress) {
  console.log("\nUpdating index with on-chain data...");
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
  console.log(`Updated ${updated} entries in index.json`);

  const merged = indexRaw.imported || [];
  const total = merged.length + 8;
  const vetted = merged.filter(it => it.vettedOk).length + 8;
  const onchain = merged.filter(it => it.onchainTokenId).length + 8;

  fs.writeFileSync(path.join(process.cwd(), "data", "skills-stats.json"), JSON.stringify({
    ok: true, total, seed: 8, imported: merged.length, user: 0, vetted, onchain,
    recent: merged.slice(-10).map(it => ({ name: it.name, slug: it.slug, source: it.source, importedAt: new Date().toISOString() })),
  }, null, 2));

  const results = merged.map(it => ({
    name: it.name || "", slug: it.slug || "",
    description: (it.description || "").slice(0, 300),
    source: it.source || "imported", vettedOk: it.vettedOk !== false, importOk: it.importOk !== false,
    riskTier: it.riskTier ?? 2, sourceUrl: it.sourceUrl || null,
    provenance: { publisher: "apeclaw-importer", signed: false },
    onchainTokenId: it.onchainTokenId || null, fileName: it.fileName || null,
    onchainMintTx: it.onchainMintTx || null, onchainPublishTx: it.onchainPublishTx || null,
  }));

  try {
    const seedDir = path.join(process.cwd(), "skillcards", "seed");
    for (const sf of fs.readdirSync(seedDir).filter(f => f.endsWith(".json"))) {
      const sc = JSON.parse(fs.readFileSync(path.join(seedDir, sf), "utf8"));
      results.unshift({
        name: sc.name || "", slug: sc.slug || "",
        description: (sc.description || "").slice(0, 300),
        source: "seed", vettedOk: true, importOk: true, riskTier: sc.constraints?.riskTier ?? 2,
        sourceUrl: sc.provenance?.sourceUrl || null,
        provenance: { publisher: "apeclaw", signed: true },
        onchainTokenId: null, fileName: sf, onchainMintTx: null, onchainPublishTx: null,
      });
    }
  } catch {}

  fs.writeFileSync(path.join(process.cwd(), "data", "skills-search.json"),
    JSON.stringify({ ok: true, total: results.length, page: 1, limit: 50000, pages: 1, results }));
  console.log(`Updated stats: total=${total}, onchain=${onchain}`);
  console.log(`Updated skills-search.json: ${results.length} results`);
}

main().catch(e => { console.error(e); process.exit(1); });
