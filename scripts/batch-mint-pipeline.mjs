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
if (!RPC || !PK || !SKILL_NFT || !REGISTRY) { console.error("Missing env"); process.exit(1); }

const URI_BASE = "https://api.apeclaw.ai/skillcards/imported";
const IMPORTED_DIR = path.join(process.cwd(), "skillcards", "imported");
const INDEX_PATH = path.join(IMPORTED_DIR, "index.json");
const PROGRESS_PATH = path.join(process.cwd(), "state", "publish-progress-9k.json");

function loadProgress() {
  try { return JSON.parse(fs.readFileSync(PROGRESS_PATH, "utf8")); }
  catch { return { published: {}, errors: [] }; }
}
function saveProgress(prog) {
  fs.mkdirSync(path.dirname(PROGRESS_PATH), { recursive: true });
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(prog, null, 2));
}
function coerceRiskTier(sc) {
  const v = sc?.constraints?.riskTier;
  return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(255, Math.floor(v))) : 2;
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const BATCH = parseInt(process.env.BATCH_SIZE || "1", 10);

async function main() {
  const account = privateKeyToAccount(PK);
  const transport = http(RPC, { timeout: 120_000, retryCount: 3, retryDelay: 2_000 });
  const publicClient = createPublicClient({ transport });
  const walletClient = createWalletClient({ transport, account, chain: { id: 33139, name: "apechain", nativeCurrency: { name: "APE", symbol: "APE", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } } });

  console.log(`Deployer: ${account.address}`);
  console.log(`Batch size: ${BATCH}`);

  const indexRaw = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
  const items = (indexRaw.imported || []).filter(it => it && it.ok !== false && it.fileName && it.slug);

  const progress = loadProgress();
  console.log(`Already published: ${Object.keys(progress.published).length}`);

  const toPub = items.filter(it => !progress.published[it.slug] && !it.onchainTokenId);
  console.log(`Skills to mint: ${toPub.length}`);

  const prepared = [];
  for (const item of toPub) {
    let sc;
    try { sc = readSkillcardJson(path.join(IMPORTED_DIR, item.fileName)); } catch { continue; }
    if (sc?.constraints?.importedStub) continue;
    prepared.push({
      item, sc,
      versionHash: computeSkillVersionHash(sc.version),
      contentHash: computeSkillcardContentHash(sc),
      riskTier: coerceRiskTier(sc),
      uri: `${URI_BASE}/${item.fileName}`,
    });
  }
  console.log(`Prepared: ${prepared.length}`);

  const startTime = Date.now();
  let published = 0;
  let errors = 0;

  for (let i = 0; i < prepared.length; i += BATCH) {
    const batch = prepared.slice(i, i + BATCH);
    const batchSize = batch.length;

    let nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: "pending" });

    const mintHashes = [];
    for (let j = 0; j < batchSize; j++) {
      try {
        const h = await walletClient.writeContract({
          address: SKILL_NFT,
          abi: SkillNFT_ABI,
          functionName: "mintSkill",
          args: [0n],
          nonce: nonce + j,
        });
        mintHashes.push({ ok: true, hash: h, idx: j });
      } catch (e) {
        mintHashes.push({ ok: false, idx: j, err: e.message?.slice(0, 120) });
      }
    }

    const mintReceipts = await Promise.all(
      mintHashes.filter(m => m.ok).map(async m => {
        try {
          const r = await publicClient.waitForTransactionReceipt({ hash: m.hash, timeout: 120_000 });
          return { ...m, confirmed: r.status === "success" };
        } catch (e) {
          return { ...m, confirmed: false, receiptErr: e.message?.slice(0, 80) };
        }
      })
    );

    const confirmedCount = mintReceipts.filter(r => r.confirmed).length;
    if (confirmedCount === 0) {
      errors += batchSize;
      for (const f of mintReceipts.filter(r => !r.confirmed)) {
        console.error(`[MINT FAIL] ${batch[f.idx].item.slug}: ${f.receiptErr || f.err || "reverted"}`);
      }
      for (const f of mintHashes.filter(m => !m.ok)) {
        console.error(`[MINT FAIL] ${batch[f.idx].item.slug}: ${f.err}`);
      }
      if (errors > 500) { console.error("Too many errors"); break; }
      await sleep(3000);
      continue;
    }

    let nextSkillId;
    try {
      nextSkillId = await publicClient.readContract({
        address: SKILL_NFT, abi: SkillNFT_ABI,
        functionName: "nextSkillId", args: [],
      });
    } catch { await sleep(1000); nextSkillId = await publicClient.readContract({
      address: SKILL_NFT, abi: SkillNFT_ABI, functionName: "nextSkillId", args: [],
    }); }

    const lastSkillId = BigInt(nextSkillId) - 1n;
    const firstSkillId = lastSkillId - BigInt(confirmedCount) + 1n;

    nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: "pending" });

    const confirmedMints = mintReceipts.filter(r => r.confirmed);
    const pubHashes = [];
    for (let j = 0; j < confirmedMints.length; j++) {
      const m = confirmedMints[j];
      const entry = batch[m.idx];
      const skillId = firstSkillId + BigInt(j);

      try {
        const h = await walletClient.writeContract({
          address: REGISTRY,
          abi: SkillRegistry_ABI,
          functionName: "publishVersion",
          args: [skillId, entry.versionHash, entry.contentHash, entry.uri, entry.riskTier],
          nonce: nonce + j,
        });
        pubHashes.push({ ok: true, hash: h, idx: m.idx, skillId, mintTx: m.hash });
      } catch (e) {
        pubHashes.push({ ok: false, idx: m.idx, skillId, err: e.message?.slice(0, 120) });
      }
    }

    const pubReceipts = await Promise.all(
      pubHashes.filter(p => p.ok).map(async p => {
        try {
          const r = await publicClient.waitForTransactionReceipt({ hash: p.hash, timeout: 120_000 });
          return { ...p, confirmed: r.status === "success" };
        } catch (e) {
          return { ...p, confirmed: false, receiptErr: e.message?.slice(0, 80) };
        }
      })
    );

    for (const p of pubReceipts.filter(r => r.confirmed)) {
      const entry = batch[p.idx];
      progress.published[entry.item.slug] = {
        skillId: String(p.skillId),
        versionHash: entry.versionHash,
        contentHash: entry.contentHash,
        uri: entry.uri,
        riskTier: entry.riskTier,
        mintTx: p.mintTx,
        publishTx: p.hash,
      };
      published++;
    }

    for (const f of pubReceipts.filter(r => !r.confirmed)) {
      errors++;
      console.error(`[PUB FAIL] ${batch[f.idx].item.slug}: ${f.receiptErr || f.err || "reverted"}`);
    }
    for (const f of pubHashes.filter(p => !p.ok)) {
      errors++;
      console.error(`[PUB FAIL] ${batch[f.idx].item.slug}: ${f.err}`);
    }
    for (const f of mintHashes.filter(m => !m.ok)) {
      errors++;
    }
    for (const f of mintReceipts.filter(r => !r.confirmed)) {
      errors++;
    }

    if (published % 50 === 0 || i + BATCH >= prepared.length) {
      saveProgress(progress);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const rate = (published / (parseFloat(elapsed) || 1)).toFixed(2);
    const remaining = prepared.length - (i + batch.length);
    const eta = remaining > 0 ? ((remaining / (parseFloat(rate) || 0.1)) / 60).toFixed(1) : "0";
    console.log(
      `[${published}/${prepared.length}] | ${elapsed}s | ${rate}/s | ETA ~${eta}m | errs=${errors}`
    );

    if (errors > 500) { console.error("Stopping: too many errors"); break; }
  }

  saveProgress(progress);
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Done in ${elapsed} min. Published: ${published}, Errors: ${errors}, Total on-chain: ${Object.keys(progress.published).length}`);

  await updateIndex(progress);
}

async function updateIndex(progress) {
  console.log("\nUpdating index.json...");
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
  console.log(`Updated ${updated} index entries.`);

  const merged = indexRaw.imported || [];
  const total = merged.length + 8;
  const vetted = merged.filter(it => it.vettedOk).length + 8;
  // Do not assume seed skills are onchain. Count only entries that actually have onchainTokenId.
  const onchain = merged.filter(it => it.onchainTokenId).length;

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
    for (const sf of fs.readdirSync(path.join(process.cwd(), "skillcards", "seed")).filter(f => f.endsWith(".json"))) {
      const sc = JSON.parse(fs.readFileSync(path.join(process.cwd(), "skillcards", "seed", sf), "utf8"));
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
  console.log(`Stats: total=${total}, onchain=${onchain}. Search: ${results.length} results.`);
}

main().catch(e => { console.error(e); process.exit(1); });
