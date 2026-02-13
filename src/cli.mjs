#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson, randomId } from "./lib/io.mjs";
import {
  QUOTES_PATH,
  BRIDGE_REQUESTS_PATH,
  POLICY_PATH,
  ALLOWLIST_PATH,
  OPENSEA_OVERRIDES_PATH,
} from "./lib/paths.mjs";
import {
  loadPolicy,
  loadAllowlist,
  normalizeAllowlist,
  resolveCollectionTarget,
  enforceBuyPolicy,
  enforceBridgePolicy,
} from "./lib/policy.mjs";
import { emitEvent } from "./lib/telemetry.mjs";
import { getListings, enrichAllowlistWithOpenSea } from "./lib/market.mjs";
import { quoteBridgeRelay, executeBridgeRelay, getBridgeRelayStatus } from "./lib/bridge-relay.mjs";
import { getListingFulfillmentData, executeListingFulfillmentTx } from "./lib/nft-opensea.mjs";
import { resolveRpcUrl } from "./lib/rpc.mjs";
import { verifyClawbot, registerClawbot, listClawbots, loadClawbotsConfig } from "./lib/clawbots.mjs";

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) out[key] = true;
      else {
        out[key] = next;
        i++;
      }
    } else out._.push(a);
  }
  return out;
}

function print(data, asJson) {
  if (asJson) console.log(JSON.stringify(data, null, 2));
  else if (typeof data === "string") console.log(data);
  else console.log(JSON.stringify(data, null, 2));
}

// Global agentId ref — set after identity resolution, used by fail()
let _agentId = "local-cli";
let _asJson = false;

function fail(message, command, payload = {}) {
  emitEvent({
    eventType: "policy.blocked",
    agentId: _agentId,
    command,
    payload,
    ok: false,
    error: message,
  });
  if (_asJson) {
    console.log(JSON.stringify({ ok: false, error: message, command }, null, 2));
  } else {
    console.error(message);
  }
  process.exit(1);
}

function loadState(filePath) {
  const obj = readJson(filePath, {});
  return obj && typeof obj === "object" ? obj : {};
}

function isoDay(value = new Date()) {
  return new Date(value).toISOString().slice(0, 10);
}

function expectedBuyConfirmPhrase(quote) {
  return `BUY ${quote.collection} #${quote.tokenId} ${quote.priceApe} APE`;
}

function expectedBridgeConfirmPhrase(req) {
  return `BRIDGE ${req.amount} ${req.token} ${req.from}->${req.to}`;
}

function authStorePath() {
  return path.join(os.homedir(), ".ape-claw", "auth.json");
}

function loadAuthStore() {
  const p = authStorePath();
  const data = readJson(p, {});
  return data && typeof data === "object" ? data : {};
}

function writeAuthStore(data) {
  const p = authStorePath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), { mode: 0o600 });
}

function maskSecret(value) {
  const v = String(value || "");
  if (!v) return "";
  if (v.length <= 8) return "*".repeat(v.length);
  return `${v.slice(0, 4)}...${v.slice(-4)}`;
}

function spentTodayFromQuotes(quotes, dayKey) {
  return Object.values(quotes).reduce((sum, q) => {
    if (!q || !q.executedAt || !q.executed) return sum;
    if (isoDay(q.executedAt) !== dayKey) return sum;
    return sum + (Number(q.priceApe) || 0);
  }, 0);
}

function spentTodayFromBridge(requests, dayKey) {
  return Object.values(requests).reduce((sum, r) => {
    if (!r || !r.submittedAt) return sum;
    if (r.status === "quoted") return sum;
    if (isoDay(r.submittedAt) !== dayKey) return sum;
    return sum + (Number(r.amount) || 0);
  }, 0);
}

function installApeClawSkill(args) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const packageRoot = path.resolve(here, "..");
  const sourceSkillPath = path.join(packageRoot, ".cursor", "skills", "ape-claw", "SKILL.md");
  if (!fs.existsSync(sourceSkillPath)) {
    throw new Error(`Source skill missing at ${sourceSkillPath}`);
  }

  const scope = String(args.scope || "local").toLowerCase();
  const explicitSkillsDir = args["skills-dir"] ? String(args["skills-dir"]) : "";
  let skillsRoot;
  if (explicitSkillsDir) skillsRoot = path.resolve(explicitSkillsDir);
  else if (scope === "global") skillsRoot = path.join(os.homedir(), ".openclaw", "skills");
  else skillsRoot = path.join(process.cwd(), ".cursor", "skills");

  const targetSkillDir = path.join(skillsRoot, "ape-claw");
  const targetSkillPath = path.join(targetSkillDir, "SKILL.md");
  fs.mkdirSync(targetSkillDir, { recursive: true });
  fs.copyFileSync(sourceSkillPath, targetSkillPath);

  // Also bootstrap config/policy.json from example if not present
  const localPolicyPath = path.join(process.cwd(), "config", "policy.json");
  const examplePolicyPath = path.join(packageRoot, "config", "policy.example.json");
  if (!fs.existsSync(localPolicyPath) && fs.existsSync(examplePolicyPath)) {
    fs.mkdirSync(path.dirname(localPolicyPath), { recursive: true });
    fs.copyFileSync(examplePolicyPath, localPolicyPath);
  }

  // Also bootstrap allowlist if not present
  const localAllowlistPath = path.join(process.cwd(), "allowlists", "recommended.apechain.json");
  const sourceAllowlistPath = path.join(packageRoot, "allowlists", "recommended.apechain.json");
  if (!fs.existsSync(localAllowlistPath) && fs.existsSync(sourceAllowlistPath)) {
    fs.mkdirSync(path.dirname(localAllowlistPath), { recursive: true });
    fs.copyFileSync(sourceAllowlistPath, localAllowlistPath);
  }

  // Also bootstrap clawbots config from example if not present
  const localClawbotsPath = path.join(process.cwd(), "config", "clawbots.json");
  const exampleClawbotsPath = path.join(packageRoot, "config", "clawbots.example.json");
  if (!fs.existsSync(localClawbotsPath) && fs.existsSync(exampleClawbotsPath)) {
    fs.copyFileSync(exampleClawbotsPath, localClawbotsPath);
  }

  const check = spawnSync("openclaw", ["skills", "check"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  const openclawAvailable = !check.error && typeof check.status === "number";
  const openclawCheckOk = openclawAvailable && check.status === 0;

  return {
    installed: true,
    scope,
    sourceSkillPath,
    skillsRoot,
    skillPath: targetSkillPath,
    openclawAvailable,
    openclawCheckOk,
    openclawCheckOutput: openclawAvailable
      ? (check.stdout || check.stderr || "").trim()
      : "openclaw CLI not found in PATH",
    next: openclawAvailable
      ? [
          "openclaw skills list",
          "openclaw skills check",
        ]
      : [
          "Install OpenClaw CLI or add it to PATH",
          "Run: openclaw skills list",
        ],
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [group, sub] = args._;
  const asJson = Boolean(args.json);
  _asJson = asJson;
  const command = `ape-claw ${args._.join(" ")}`.trim();

  // Allow skill installation in any directory without local ape-claw config.
  if (group === "skill" && sub === "install") {
    const result = installApeClawSkill(args);
    emitEvent({ eventType: "skill.install.ran", command, dryRun: true, result });
    return print(result, asJson);
  }

  // ── Clawbot commands (before policy load so they work in any directory)
  if (group === "clawbot" && sub === "register") {
    const agentId = String(args["agent-id"] || "").trim();
    const displayName = String(args.name || agentId || "").trim();
    if (!agentId) fail("--agent-id is required", command, args);
    try {
      const reg = registerClawbot({ agentId, displayName });
      const result = {
        registered: true,
        agentId: reg.agentId,
        name: reg.displayName,
        token: reg.token,
        note: "Save this token — it is shown only once. Use as APE_CLAW_AGENT_TOKEN or --agent-token.",
      };
      emitEvent({ eventType: "clawbot.registered", command, dryRun: true, result: { agentId: reg.agentId, name: reg.displayName } });
      return print(result, asJson);
    } catch (err) {
      fail(err.message, command, { agentId });
    }
  }
  if (group === "clawbot" && sub === "list") {
    const bots = listClawbots();
    const result = { count: bots.length, clawbots: bots };
    emitEvent({ eventType: "clawbot.list.read", command, dryRun: true, result: { count: bots.length } });
    return print(result, asJson);
  }

  // ── Local auth profile commands (stored in ~/.ape-claw/auth.json)
  if (group === "auth" && sub === "set") {
    const current = loadAuthStore();
    const next = { ...current };
    let changed = 0;

    const setIfProvided = (flag, key) => {
      if (args[flag] !== undefined) {
        const val = String(args[flag] || "").trim();
        if (val) next[key] = val;
        else delete next[key];
        changed++;
      }
    };

    setIfProvided("agent-id", "agentId");
    setIfProvided("agent-token", "agentToken");
    setIfProvided("opensea-api-key", "openseaApiKey");
    setIfProvided("private-key", "privateKey");

    if (changed === 0) {
      fail("Provide at least one of --agent-id --agent-token --opensea-api-key --private-key", command, args);
    }

    writeAuthStore(next);
    const result = {
      ok: true,
      saved: true,
      path: authStorePath(),
      fields: {
        agentId: next.agentId || null,
        agentToken: Boolean(next.agentToken),
        openseaApiKey: Boolean(next.openseaApiKey),
        privateKey: Boolean(next.privateKey),
      },
      note: "Secrets are stored locally in ~/.ape-claw/auth.json (mode 600). Env vars and flags still override these values.",
    };
    emitEvent({ eventType: "auth.saved", command, dryRun: true, result: { path: authStorePath() } });
    return print(result, asJson);
  }

  if (group === "auth" && sub === "show") {
    const cur = loadAuthStore();
    const result = {
      ok: true,
      path: authStorePath(),
      auth: {
        agentId: cur.agentId || null,
        agentToken: cur.agentToken ? maskSecret(cur.agentToken) : null,
        openseaApiKey: cur.openseaApiKey ? maskSecret(cur.openseaApiKey) : null,
        privateKey: cur.privateKey ? maskSecret(cur.privateKey) : null,
      },
    };
    return print(result, asJson);
  }

  if (group === "auth" && sub === "clear") {
    const cur = loadAuthStore();
    const field = String(args.field || "").trim();
    if (Boolean(args.all)) {
      writeAuthStore({});
      return print({ ok: true, cleared: "all", path: authStorePath() }, asJson);
    }
    const allowed = new Set(["agent-id", "agent-token", "opensea-api-key", "private-key"]);
    if (!allowed.has(field)) {
      fail('Use --field one of: "agent-id" | "agent-token" | "opensea-api-key" | "private-key", or --all', command, args);
    }
    const keyMap = {
      "agent-id": "agentId",
      "agent-token": "agentToken",
      "opensea-api-key": "openseaApiKey",
      "private-key": "privateKey",
    };
    delete cur[keyMap[field]];
    writeAuthStore(cur);
    return print({ ok: true, cleared: field, path: authStorePath() }, asJson);
  }

  // ── Resolve agent identity
  const storedAuth = loadAuthStore();
  const agentId = String(args["agent-id"] || process.env.APE_CLAW_AGENT_ID || storedAuth.agentId || "local-cli").trim();
  _agentId = agentId;
  const agentToken = String(args["agent-token"] || process.env.APE_CLAW_AGENT_TOKEN || storedAuth.agentToken || "").trim();
  let verifiedBot = null;
  let sharedOpenseaKey = "";
  if (agentToken) {
    const v = verifyClawbot({ agentId, agentToken });
    if (v.verified) {
      verifiedBot = v.agent;
      sharedOpenseaKey = v.sharedOpenseaApiKey || "";
    } else {
      fail(`Clawbot verification failed: ${v.reason}. Register first with: ape-claw clawbot register --agent-id <id> --json`, command, { agentId });
    }
  }

  // Override emitEvent defaults with agentId
  const emit = (opts) => emitEvent({ ...opts, agentId });

  const policy = loadPolicy();
  let allowlist = normalizeAllowlist(loadAllowlist());
  // Use shared key for verified bots, else fall back to env
  const openseaKey = process.env.OPENSEA_API_KEY || sharedOpenseaKey || storedAuth.openseaApiKey || "";
  const relayApiKey = process.env.RELAY_API_KEY || "";
  const privateKey = process.env.APE_CLAW_PRIVATE_KEY || storedAuth.privateKey || "";
  const slugOverrides = readJson(OPENSEA_OVERRIDES_PATH, {}) || {};

  if (group === "doctor") {
    const unresolvedCount = allowlist.filter((c) => !c.contractAddress).length;
    const openseaRequired = String(policy.market.dataSource || "").toLowerCase() === "opensea";
    const clawbotsConfig = loadClawbotsConfig() || {};
    const registeredAgent = Boolean(clawbotsConfig?.agents?.[agentId]);
    const sharedKeyConfigured = Boolean(clawbotsConfig?.sharedOpenseaApiKey);
    const sharedKeyInjected = Boolean(sharedOpenseaKey);
    const openseaProvided = Boolean(openseaKey);
    const openseaMissing = openseaRequired && !openseaProvided;
    const privateKeyMissing = !privateKey;
    const issues = [];
    const warnings = [];
    if (openseaMissing) {
      warnings.push("OpenSea API key is not available for this agent. Set OPENSEA_API_KEY, or verify a clawbot so sharedOpenseaApiKey can be injected.");
    }
    if (registeredAgent && sharedKeyConfigured && !sharedKeyInjected) {
      warnings.push("This agent is registered and shared OpenSea key is configured, but not injected yet. Provide --agent-token (or save once via: ape-claw auth set --agent-id <id> --agent-token <token> --json).");
    }
    if (privateKeyMissing) {
      warnings.push("Private key not detected for execute flows. Read-only commands are ready. For execution, provide APE_CLAW_PRIVATE_KEY, save with ape-claw auth set --private-key, or map your OpenClaw bot secret to APE_CLAW_PRIVATE_KEY.");
    }
    const executeReady = !openseaMissing && !privateKeyMissing;
    const readOnlyReady = issues.length === 0;
    const nextSteps = [];
    if (registeredAgent && !verifiedBot) {
      nextSteps.push("Verify this registered clawbot to inject shared OpenSea key: ape-claw doctor --agent-id <id> --agent-token <token> --json");
      nextSteps.push("Or persist once: ape-claw auth set --agent-id <id> --agent-token <token> --json");
    }
    if (openseaMissing && !registeredAgent) {
      nextSteps.push("Standalone mode: set OPENSEA_API_KEY (env) or save with ape-claw auth set --opensea-api-key <key> --json");
    }
    if (privateKeyMissing) {
      nextSteps.push("For execute flows, set APE_CLAW_PRIVATE_KEY (env), or save with ape-claw auth set --private-key 0x... --json");
      nextSteps.push("If your OpenClaw bot already has a wallet secret, map/export it as APE_CLAW_PRIVATE_KEY before running execute commands.");
    }
    if (!privateKeyMissing && !openseaMissing) {
      nextSteps.push("Execute-ready: you can run buy/bridge commands with --execute.");
    } else {
      nextSteps.push("Read-only ready: use market/quote/simulate flows now, then complete missing execute prerequisites.");
    }
    const result = {
      ok: issues.length === 0,
      issues,
      warnings,
      chainId: policy.apechainChainId,
      rpcConfigured: Boolean(policy.apechainRpcUrl),
      agent: {
        agentId,
        verified: Boolean(verifiedBot),
        name: verifiedBot?.name || agentId,
        sharedKeyAvailable: sharedKeyInjected,
        sharedKeyInjected,
        localAuthProfile: Boolean(storedAuth.agentId || storedAuth.agentToken || storedAuth.openseaApiKey || storedAuth.privateKey),
        registered: registeredAgent,
      },
      bridge: {
        provider: policy.bridge.provider,
        relayApiKeyRequired: false,
        relayApiKeyProvided: Boolean(process.env.RELAY_API_KEY),
        executeRequiresPrivateKey: true,
      },
      market: {
        dataSource: policy.market.dataSource,
        openseaApiKeyRequired: openseaRequired,
        openseaApiKeyProvided: openseaProvided,
      },
      execution: {
        privateKeyProvided: !privateKeyMissing,
        readOnlyReady,
        executeReady,
        dailySpendCap: policy.execution.dailySpendCap,
        confirmPhraseRequired: policy.execution.confirmPhraseRequired,
        simulationRequired: policy.nftBuy.simulationRequired,
        maxPricePerTx: policy.nftBuy.maxPricePerTx,
      },
      policyPath: POLICY_PATH,
      allowlistPath: ALLOWLIST_PATH,
      allowlistStats: { total: allowlist.length, unresolvedCount },
      recommendations: ["Use --json for agent parsing", "Use --execute for state-changing calls"],
      nextSteps,
    };
    emit({ eventType: "doctor.ran", command, dryRun: true, result });
    return print(result, asJson);
  }

  if (group === "chain" && sub === "info") {
    const chainId = Number(policy.apechainChainId || 33139);
    let latestBlock = null;
    try {
      const rpcUrl = await resolveRpcUrl(chainId, policy);
      const rpcRes = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
      });
      const rpcJson = await rpcRes.json();
      if (rpcJson.result) latestBlock = parseInt(rpcJson.result, 16);
    } catch {
      // RPC unavailable — leave null so bots know it's unknown
    }
    const result = {
      chainId,
      nativeGasToken: policy.nativeGasToken,
      bridgeProvider: policy.bridge.provider,
      marketDataSource: policy.market.dataSource,
      latestBlock,
      rpcOk: latestBlock !== null,
    };
    emit({ eventType: "chain.info.read", command, dryRun: true, result });
    return print(result, asJson);
  }

  if (group === "market" && sub === "collections") {
    const recommendedOnly = Boolean(args.recommended);
    if (String(policy.market.dataSource).toLowerCase() === "opensea" && openseaKey) {
      const enriched = await enrichAllowlistWithOpenSea(allowlist, openseaKey, slugOverrides);
      allowlist = enriched.allowlist;
    }
    const data = recommendedOnly ? allowlist.filter((c) => c.enabled !== false) : allowlist;
    // Strip rank from agent-facing output — rank is metadata only, never a decision signal
    const collections = data.map(({ rank, ...rest }) => rest);
    const result = { count: collections.length, collections, source: policy.market.dataSource };
    emit({
      eventType: "market.collections.read",
      command,
      dryRun: true,
      result: { count: data.length, source: policy.market.dataSource },
    });
    return print(result, asJson);
  }

  if (group === "market" && sub === "listings") {
    const collection = args.collection;
    if (!collection) fail("--collection is required", command, args);
    const maxPrice = Number(args.maxPrice || policy.nftBuy.maxPricePerTx);
    let result;
    try {
      const out = await getListings({
        collection,
        tokenId: args.tokenId,
        maxPrice,
        dataSource: args.dataSource || policy.market.dataSource,
        apiKey: openseaKey,
        slugOverrides,
      });
      const listings = out.listings || [];
      result = { count: listings.length, listings, source: out.source, notes: out.notes || [] };
    } catch (err) {
      result = { count: 0, listings: [], source: policy.market.dataSource, error: err.message };
      emit({
        eventType: "market.listings.failed",
        command,
        dryRun: true,
        payload: args,
        result,
        ok: false,
        error: err.message,
      });
      return print(result, asJson);
    }
    emit({ eventType: "market.listings.read", command, dryRun: true, payload: args, result });
    return print(result, asJson);
  }

  if (group === "nft" && sub === "quote-buy") {
    const collection = args.collection;
    const tokenId = args.tokenId;
    const maxPrice = Number(args.maxPrice);
    const currency = String(args.currency || "APE").toUpperCase();
    if (!collection || !tokenId || Number.isNaN(maxPrice)) {
      fail("Required: --collection --tokenId --maxPrice", command, args);
    }
    if (maxPrice <= 0) fail("--maxPrice must be > 0", command, args);
    const policyCheck = enforceBuyPolicy({
      policy,
      collection,
      maxPrice,
      currency,
      allowUnsafe: Boolean(args["allow-unsafe"]),
      allowlist,
    });
    if (!policyCheck.ok) fail(policyCheck.errors.join(" "), command, args);
    const target = policyCheck.target || resolveCollectionTarget(collection, allowlist).exact;
    const resolvedCollection = target?.contractAddress || target?.slug || collection;

    let liveListing = null;
    try {
      const listingsOut = await getListings({
        collection: target?.slug || collection,
        tokenId,
        maxPrice,
        dataSource: args.dataSource || policy.market.dataSource,
        apiKey: openseaKey,
        slugOverrides,
      });
      const candidates = listingsOut.listings || [];
      liveListing =
        candidates.find((l) => String(l.tokenId) === String(tokenId)) ||
        candidates[0] ||
        null;
    } catch (err) {
      fail(`Live listing lookup failed: ${err.message}`, command, args);
    }
    if (!liveListing) {
      fail(`No live listing found for collection=${collection} tokenId=${tokenId} under maxPrice=${maxPrice}.`, command, args);
    }

    const quoteId = randomId("q");
    const priceApe = Number(liveListing.priceApe);
    if (!Number.isFinite(priceApe) || priceApe <= 0) {
      fail("Invalid live listing price returned by market provider.", command, args);
    }
    const quote = {
      quoteId,
      collection,
      collectionTarget: resolvedCollection,
      tokenId,
      currency,
      priceApe,
      maxPrice,
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      listingId: liveListing.listingId,
      orderHash: liveListing.orderHash || randomId("order"),
      routeHash: liveListing.source || "opensea",
      source: liveListing.source || "opensea",
      protocolAddress: liveListing.protocolAddress || "0x0000000000000068f116a894984e2db1123eb395",
      assetContractAddress: liveListing.assetContractAddress || target?.contractAddress || null,
      chainId: Number(policy.apechainChainId || 33139),
      dryRunDefault: true,
    };
    const quotes = loadState(QUOTES_PATH);
    quotes[quoteId] = quote;
    writeJson(QUOTES_PATH, quotes);

    emit({
      eventType: "nft.quote.created",
      command,
      dryRun: true,
      payload: { collection, tokenId, maxPrice, currency, allowUnsafe: Boolean(args["allow-unsafe"]) },
      result: quote,
    });
    return print(quote, asJson);
  }

  if (group === "nft" && sub === "simulate") {
    const quoteId = args.quote;
    if (!quoteId) fail("--quote is required", command, args);
    const quotes = loadState(QUOTES_PATH);
    const quote = quotes[quoteId];
    if (!quote) fail(`Unknown quote ${quoteId}`, command, args);
    const ok = new Date(quote.expiresAt).getTime() > Date.now();
    quote.simulation = {
      ok,
      simulatedAt: new Date().toISOString(),
      reason: ok ? "simulation_passed" : "quote_expired",
    };
    quotes[quoteId] = quote;
    writeJson(QUOTES_PATH, quotes);
    const result = { quoteId, ok, reason: ok ? "simulation_passed" : "quote_expired" };
    emit({
      eventType: ok ? "nft.simulation.passed" : "nft.simulation.failed",
      command,
      dryRun: true,
      payload: { quoteId },
      result,
      ok,
      error: ok ? null : "quote expired",
    });
    if (!ok) process.exit(1);
    return print(result, asJson);
  }

  if (group === "nft" && sub === "buy") {
    const quoteId = args.quote;
    if (!quoteId) fail("--quote is required", command, args);
    const execute = Boolean(args.execute);
    const autonomous = Boolean(args.autonomous);
    const quotes = loadState(QUOTES_PATH);
    const quote = quotes[quoteId];
    if (!quote) fail(`Unknown quote ${quoteId}`, command, args);
    if (quote.executed) fail("Quote already executed. Generate a fresh quote.", command, { quoteId });
    if (new Date(quote.expiresAt).getTime() <= Date.now()) {
      fail("Quote expired. Generate a fresh quote.", command, { quoteId });
    }
    if (!execute) {
      const result = { dryRun: true, message: "No broadcast. Pass --execute to send transaction.", quote };
      emit({ eventType: "nft.buy.dry_run", command, dryRun: true, payload: { quoteId }, result });
      return print(result, asJson);
    }
    if (policy.nftBuy.simulationRequired && autonomous) {
      const ok = new Date(quote.expiresAt).getTime() > Date.now();
      quote.simulation = {
        ok,
        simulatedAt: new Date().toISOString(),
        reason: ok ? "simulation_passed" : "quote_expired",
      };
      quotes[quoteId] = quote;
      writeJson(QUOTES_PATH, quotes);
      const simResult = { quoteId, ok, reason: ok ? "simulation_passed" : "quote_expired", autonomous: true };
      emit({
        eventType: ok ? "nft.simulation.passed" : "nft.simulation.failed",
        command,
        dryRun: false,
        payload: { quoteId, autonomous: true },
        result: simResult,
        ok,
        error: ok ? null : "quote expired",
      });
      if (!ok) fail("Quote expired. Generate a fresh quote.", command, { quoteId, autonomous: true });
    }
    if (policy.nftBuy.simulationRequired && !quote.simulation?.ok) {
      fail("Simulation required before execute. Run: ape-claw nft simulate --quote <id> --json", command, {
        quoteId,
      });
    }
    if (policy.execution.confirmPhraseRequired) {
      const expected = expectedBuyConfirmPhrase(quote);
      const got = autonomous ? expected : String(args.confirm || "");
      if (got !== expected) {
        fail(`Confirmation phrase mismatch. Use --confirm "${expected}"`, command, { quoteId });
      }
    }
    const today = isoDay();
    const bridgeRequests = loadState(BRIDGE_REQUESTS_PATH);
    const spentNft = spentTodayFromQuotes(quotes, today);
    const spentBridge = spentTodayFromBridge(bridgeRequests, today);
    const spentToday = spentNft + spentBridge;
    const projected = spentToday + (Number(quote.priceApe) || 0);
    const cap = Number(policy.execution.dailySpendCap || 0);
    if (cap > 0 && projected > cap) {
      fail(`Daily spend cap exceeded (${projected.toFixed(2)} > ${cap} APE, including bridge).`, command, {
        quoteId,
        spentNft,
        spentBridge,
        projected,
        cap,
      });
    }
    if (!openseaKey) {
      fail("OPENSEA_API_KEY is required for live nft execute (fulfillment data).", command, { quoteId });
    }
    if (!privateKey) {
      fail("APE_CLAW_PRIVATE_KEY is required for live nft execute.", command, { quoteId });
    }

    const chainId = Number(quote.chainId || policy.apechainChainId || 33139);
    const rpcUrl = await resolveRpcUrl(chainId, policy);
    const fulfillerAddress = String(args.user || "");
    const confirmedPrice = Number(quote.priceApe);
    const maxRetries = 3;
    let fulfillment = null;
    let usedOrderHash = quote.orderHash;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        fulfillment = await getListingFulfillmentData({
          apiKey: openseaKey,
          orderHash: usedOrderHash,
          protocolAddress: quote.protocolAddress || "0x0000000000000068f116a894984e2db1123eb395",
          chainId,
          fulfillerAddress: fulfillerAddress || undefined,
          privateKey,
          assetContractAddress: quote.assetContractAddress || undefined,
          tokenId: quote.tokenId,
        });
        break;
      } catch (err) {
        const isOrderNotFound = /order not found/i.test(err.message);
        if (!isOrderNotFound || attempt >= maxRetries) throw err;
        // Order was sniped/cancelled — re-fetch a fresh listing for the same collection+token
        // SAFETY: only accept replacement listings at or below the confirmed price
        emit({
          eventType: "nft.buy.retry",
          command,
          dryRun: false,
          payload: { quoteId, attempt, reason: "order_not_found", oldOrderHash: usedOrderHash, confirmedPrice },
          ok: true,
        });
        try {
          const fresh = await getListings({
            collection: quote.collectionTarget || quote.collection,
            tokenId: quote.tokenId,
            maxPrice: confirmedPrice,
            dataSource: policy.market.dataSource,
            apiKey: openseaKey,
            slugOverrides,
          });
          const candidates = fresh.listings || [];
          const match =
            candidates.find((l) => String(l.tokenId) === String(quote.tokenId) && Number(l.priceApe) <= confirmedPrice) ||
            candidates.find((l) => Number(l.priceApe) <= confirmedPrice) ||
            null;
          if (!match) throw new Error(`No replacement listing found at or below confirmed price (${confirmedPrice} APE).`);
          usedOrderHash = match.orderHash;
          quote.orderHash = match.orderHash;
          quote.listingId = match.listingId;
          quote.priceApe = match.priceApe;
          quote.assetContractAddress = match.assetContractAddress || quote.assetContractAddress;
          quote.protocolAddress = match.protocolAddress || quote.protocolAddress;
        } catch (refreshErr) {
          throw new Error(`Original order sniped and refresh failed: ${refreshErr.message}`);
        }
      }
    }
    if (!fulfillment) fail("Failed to get fulfillment data after retries.", command, { quoteId });
    const sent = await executeListingFulfillmentTx({
      fulfillmentData: fulfillment,
      privateKey,
      rpcUrl,
    });
    quote.executed = true;
    quote.executedAt = new Date().toISOString();
    quote.txHash = sent.txHash;
    quote.seaport = {
      chainId: sent.chainId,
      to: sent.to,
      functionName: sent.functionName,
    };
    quotes[quoteId] = quote;
    writeJson(QUOTES_PATH, quotes);
    const result = {
      ok: true,
      quoteId,
      txHash: sent.txHash,
      chainId: sent.chainId,
      quote: {
        quoteId: quote.quoteId,
        collection: quote.collection,
        collectionTarget: quote.collectionTarget,
        tokenId: quote.tokenId,
        priceApe: quote.priceApe,
        currency: quote.currency,
        listingId: quote.listingId,
        orderHash: quote.orderHash,
        source: quote.source,
      },
    };
    emit({
      eventType: "nft.buy.confirmed",
      command,
      dryRun: false,
      payload: {
        quoteId,
        collection: quote.collection,
        tokenId: quote.tokenId,
        priceApe: quote.priceApe,
        currency: quote.currency,
        autonomous,
      },
      result,
    });
    return print(result, asJson);
  }

  if (group === "bridge" && sub === "quote") {
    const from = String(args.from || "");
    const to = String(args.to || policy.bridge.defaultTo || "apechain");
    const token = String(args.token || policy.bridge.defaultToken || "APE");
    const amount = Number(args.amount);
    if (!from || Number.isNaN(amount)) {
      fail("Required: --from --amount (defaults: --to apechain --token APE)", command, args);
    }
    if (amount <= 0) fail("--amount must be > 0", command, args);
    if (String(policy.bridge.provider || "").toLowerCase() !== "relay") {
      fail(`Unsupported bridge provider: ${policy.bridge.provider}. Set bridge.provider=relay.`, command, args);
    }
    const req = await quoteBridgeRelay({
      from,
      to,
      token,
      amount,
      args,
      apiKey: relayApiKey,
      privateKey,
    });
    const feeBpsForPolicy = req.feeBps ?? 0;
    const check = enforceBridgePolicy({ policy, feeBps: feeBpsForPolicy });
    if (!check.ok) fail(check.errors.join(" "), command, args);
    const requests = loadState(BRIDGE_REQUESTS_PATH);
    requests[req.requestId] = req;
    writeJson(BRIDGE_REQUESTS_PATH, requests);
    emit({ eventType: "bridge.quote.created", command, dryRun: true, payload: args, result: req });
    return print(req, asJson);
  }

  if (group === "bridge" && sub === "execute") {
    const requestId = args.request;
    if (!requestId) fail("--request is required", command, args);
    const execute = Boolean(args.execute);
    const autonomous = Boolean(args.autonomous);
    const requests = loadState(BRIDGE_REQUESTS_PATH);
    const req = requests[requestId];
    if (!req) fail(`Unknown request ${requestId}`, command, args);
    if (req.status === "confirmed") fail("Bridge request already executed.", command, { requestId });
    if (new Date(req.expiresAt).getTime() <= Date.now()) fail("Bridge quote expired.", command, { requestId });
    if (!execute) {
      const result = { dryRun: true, message: "No broadcast. Pass --execute to bridge.", request: req };
      emit({ eventType: "bridge.execute.dry_run", command, dryRun: true, payload: { requestId }, result });
      return print(result, asJson);
    }
    if (policy.execution.confirmPhraseRequired) {
      const expected = expectedBridgeConfirmPhrase(req);
      const got = autonomous ? expected : String(args.confirm || "");
      if (got !== expected) {
        fail(`Confirmation phrase mismatch. Use --confirm "${expected}"`, command, { requestId });
      }
    }
    if (!privateKey) {
      fail("APE_CLAW_PRIVATE_KEY is required for live bridge execute.", command, { requestId });
    }
    const today = isoDay();
    const quotes = loadState(QUOTES_PATH);
    const spentNft = spentTodayFromQuotes(quotes, today);
    const spentBridge = spentTodayFromBridge(requests, today);
    const projectedBridge = spentNft + spentBridge + (Number(req.amount) || 0);
    const cap = Number(policy.execution.dailySpendCap || 0);
    if (cap > 0 && projectedBridge > cap) {
      fail(`Daily spend cap exceeded (${projectedBridge.toFixed(2)} > ${cap} APE, including bridge).`, command, {
        requestId,
        spentNft,
        spentBridge,
        projectedBridge,
        cap,
      });
    }
    const executed = await executeBridgeRelay({
      request: req,
      privateKey,
      policy,
    });
    requests[requestId] = executed;
    writeJson(BRIDGE_REQUESTS_PATH, requests);
    emit({
      eventType: "bridge.execute.confirmed",
      command,
      dryRun: false,
      payload: { requestId, autonomous },
      result: executed,
    });
    return print(executed, asJson);
  }

  if (group === "bridge" && sub === "status") {
    const requestId = args.request;
    if (!requestId) fail("--request is required", command, args);
    const requests = loadState(BRIDGE_REQUESTS_PATH);
    const req = requests[requestId];
    if (!req) fail(`Unknown request ${requestId}`, command, args);
    const status = await getBridgeRelayStatus({
      request: req,
      apiKey: relayApiKey,
    });
    const merged = {
      ...req,
      status: status.status || req.status,
      relayStatus: status.relayStatus || null,
      destinationTxHash: status.destinationTxHash || req.destinationTxHash || null,
      lastStatusCheckAt: new Date().toISOString(),
    };
    requests[requestId] = merged;
    writeJson(BRIDGE_REQUESTS_PATH, requests);
    emit({ eventType: "bridge.status.read", command, dryRun: true, payload: { requestId }, result: merged });
    return print(merged, asJson);
  }

  if (group === "allowlist" && sub === "audit") {
    const unresolved = allowlist.filter((c) => !c.contractAddress);
    // Check for slug collisions (real identity) instead of rank collisions
    const bySlug = new Map();
    const slugCollisions = [];
    for (const c of allowlist) {
      const slug = String(c.slug || "").toLowerCase();
      if (slug && bySlug.has(slug)) slugCollisions.push(slug);
      if (slug) bySlug.set(slug, c);
    }
    const result = {
      total: allowlist.length,
      unresolvedCount: unresolved.length,
      unresolved: unresolved.map((c) => ({ name: c.name, slug: c.slug })),
      slugCollisions,
    };
    emit({
      eventType: "allowlist.audit.ran",
      command,
      dryRun: true,
      result: { total: result.total, unresolvedCount: result.unresolvedCount, slugCollisions },
    });
    return print(result, asJson);
  }

  const helpObj = {
    ok: false,
    error: `Unknown command: ${args._.join(" ")}`,
    commands: {
      doctor: "ape-claw doctor --json",
      "clawbot register": "ape-claw clawbot register --agent-id <id> --name <name> --json",
      "clawbot list": "ape-claw clawbot list --json",
      "auth set": "ape-claw auth set [--agent-id <id>] [--agent-token <token>] [--opensea-api-key <key>] [--private-key <pk>] --json",
      "auth show": "ape-claw auth show --json",
      "auth clear": "ape-claw auth clear --field <agent-id|agent-token|opensea-api-key|private-key> --json",
      "chain info": "ape-claw chain info --json",
      "market collections": "ape-claw market collections --recommended --json",
      "market listings": "ape-claw market listings --collection <slug> --maxPrice <n> --json",
      "nft quote-buy": "ape-claw nft quote-buy --collection <slug> --tokenId <id> --maxPrice <n> --currency APE --json",
      "nft simulate": "ape-claw nft simulate --quote <quoteId> --json",
      "nft buy": 'ape-claw nft buy --quote <quoteId> --execute --confirm "BUY <collection> #<tokenId> <priceApe> APE" --json',
      "nft buy (autonomous)": "ape-claw nft buy --quote <quoteId> --execute --autonomous --json",
      "bridge quote": "ape-claw bridge quote --from <chain> --amount <n> --json",
      "bridge execute": 'ape-claw bridge execute --request <requestId> --execute --confirm "BRIDGE <amount> <token> <from>-><to>" --json',
      "bridge execute (autonomous)": "ape-claw bridge execute --request <requestId> --execute --autonomous --json",
      "bridge status": "ape-claw bridge status --request <requestId> --json",
      "allowlist audit": "ape-claw allowlist audit --json",
      "skill install": "ape-claw skill install --scope local --json",
    },
    globalFlags: {
      "--json": "Required. All output as JSON for deterministic parsing.",
      "--agent-id <id>": "Clawbot agent ID (or APE_CLAW_AGENT_ID env var).",
      "--agent-token <token>": "Clawbot auth token (or APE_CLAW_AGENT_TOKEN env var).",
      "--opensea-api-key <key>": "For auth set: persist OpenSea key in local auth profile.",
      "--private-key <pk>": "For auth set: persist wallet private key in local auth profile.",
    },
    note: "Global flags (--agent-id, --agent-token, --json) can appear anywhere in the command.",
  };
  if (asJson) {
    console.log(JSON.stringify(helpObj, null, 2));
  } else {
    console.log(`Unknown command: ${args._.join(" ")}\n`);
    console.log("Commands:");
    for (const [name, example] of Object.entries(helpObj.commands)) {
      console.log(`  ${name.padEnd(22)} ${example}`);
    }
    console.log("\nGlobal flags: --json --agent-id <id> --agent-token <token>");
    console.log("Note: global flags can appear anywhere in the command.\n");
  }
  process.exit(1);
}

main().catch((err) => {
  console.error(err.message || String(err));
  process.exit(1);
});

