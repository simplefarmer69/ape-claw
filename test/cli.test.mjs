import test from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function run(cmd) {
  return execSync(cmd, { cwd: process.cwd(), encoding: "utf8" });
}

function runFail(cmd) {
  try {
    execSync(cmd, { cwd: process.cwd(), encoding: "utf8", stdio: "pipe" });
    return "";
  } catch (err) {
    const stdout = String(err.stdout || "");
    const stderr = String(err.stderr || "");
    return `${stdout}\n${stderr}`.trim();
  }
}

function runFailJson(cmd) {
  const raw = runFail(cmd);
  // The JSON error is on stdout — extract first JSON object
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

test("doctor command returns json with chainId", () => {
  const out = run("node ./src/cli.mjs doctor --json");
  const data = JSON.parse(out);
  assert.equal(data.chainId, 33139);
  assert.ok(Array.isArray(data.issues), "issues should be an array");
  assert.ok("agent" in data, "should include agent identity");
  assert.ok("agentId" in data.agent, "agent should have agentId");
  // Without env vars, ok should be false (missing OPENSEA_API_KEY and PRIVATE_KEY)
  if (!process.env.OPENSEA_API_KEY || !process.env.APE_CLAW_PRIVATE_KEY) {
    assert.equal(data.ok, false);
    assert.ok(data.issues.length > 0, "should report missing env vars");
  }
});

test("chain info returns json with latestBlock field", async () => {
  const out = run("node ./src/cli.mjs chain info --json");
  const data = JSON.parse(out);
  assert.equal(data.chainId, 33139);
  assert.ok("latestBlock" in data, "should include latestBlock");
  assert.ok("rpcOk" in data, "should include rpcOk");
  assert.equal(typeof data.rpcOk, "boolean");
});

test("clawbot list returns json array", () => {
  const out = run("node ./src/cli.mjs clawbot list --json");
  const data = JSON.parse(out);
  assert.ok("count" in data, "should include count");
  assert.ok(Array.isArray(data.clawbots), "clawbots should be an array");
});

test("unknown command with --json returns structured error", () => {
  const data = runFailJson("node ./src/cli.mjs zzzz --json");
  assert.ok(data, "should return parseable JSON");
  assert.equal(data.ok, false);
  assert.ok(typeof data.error === "string");
  assert.ok("commands" in data, "should include commands map");
});

test("--json errors are valid json", () => {
  const data = runFailJson("node ./src/cli.mjs nft buy --json");
  assert.ok(data, "should return parseable JSON on error");
  assert.equal(data.ok, false);
  assert.ok(typeof data.error === "string");
});

test("quote-buy creates quote", () => {
  const msg = runFail(
    'node ./src/cli.mjs nft quote-buy --collection "Mintotaurs" --tokenId 123 --maxPrice 40 --currency APE --json',
  );
  assert.match(msg, /Live listing lookup failed|OpenSea data source selected but OPENSEA_API_KEY is missing/);
});

test("nft buy execute requires simulation first", () => {
  const quote = {
    quoteId: "q_test_no_sim",
    collection: "Mintotaurs",
    tokenId: "777",
    priceApe: 40,
    maxPrice: 40,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    orderHash: "order_test",
    listingId: "listing_test",
  };
  const statePath = path.join(process.cwd(), "state", "quotes.json");
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify({ [quote.quoteId]: quote }, null, 2));
  const msg = runFail(`node ./src/cli.mjs nft buy --quote ${quote.quoteId} --execute --json`);
  assert.match(msg, /Simulation required before execute/);
});

test("nft buy execute requires confirm phrase", () => {
  const quote = {
    quoteId: "q_test_confirm",
    collection: "Mintotaurs",
    tokenId: "778",
    priceApe: 40,
    maxPrice: 40,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    orderHash: "order_test2",
    listingId: "listing_test2",
  };
  const statePath = path.join(process.cwd(), "state", "quotes.json");
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify({ [quote.quoteId]: quote }, null, 2));
  run(`node ./src/cli.mjs nft simulate --quote ${quote.quoteId} --json`);
  const msg = runFail(`node ./src/cli.mjs nft buy --quote ${quote.quoteId} --execute --json`);
  assert.match(msg, /Confirmation phrase mismatch/);
});

test("bridge execute requires confirm phrase", () => {
  const req = {
    requestId: "br_test_confirm_phrase",
    from: "ethereum",
    to: "apechain",
    token: "APE",
    amount: 20,
    status: "quoted",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
  const statePath = path.join(process.cwd(), "state", "bridge-requests.json");
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify({ [req.requestId]: req }, null, 2));
  const msg = runFail(`node ./src/cli.mjs bridge execute --request ${req.requestId} --execute --json`);
  assert.match(msg, /Confirmation phrase mismatch/);
});

