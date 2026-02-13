import test from "node:test";
import assert from "node:assert/strict";
import { enforceBuyPolicy, enforceBridgePolicy } from "../src/lib/policy.mjs";

const policy = {
  bridge: { maxBridgeFeeBps: 100 },
  market: { collectionAllowlistMode: "recommended-only" },
  nftBuy: { maxPricePerTx: 100, currencyAllowlist: ["APE", "WAPE", "WETH"] },
};

test("buy policy blocks disallowed currency", () => {
  const res = enforceBuyPolicy({
    policy,
    collection: "DSNRS",
    maxPrice: 10,
    currency: "USDC",
    allowlist: [{ name: "DSNRS" }],
  });
  assert.equal(res.ok, false);
});

test("buy policy blocks collections outside allowlist", () => {
  const res = enforceBuyPolicy({
    policy,
    collection: "RandomNFT",
    maxPrice: 10,
    currency: "APE",
    allowlist: [{ name: "DSNRS" }],
  });
  assert.equal(res.ok, false);
});

test("bridge policy blocks fee over cap", () => {
  const res = enforceBridgePolicy({ policy, feeBps: 250 });
  assert.equal(res.ok, false);
});

test("buy policy blocks unresolved contract address by default", () => {
  const res = enforceBuyPolicy({
    policy,
    collection: "DSNRS",
    maxPrice: 10,
    currency: "APE",
    allowlist: [{ name: "DSNRS", slug: "dsnrs", contractAddress: null }],
  });
  assert.equal(res.ok, false);
});

test("buy policy allows unresolved collection when allow-unsafe is set", () => {
  const res = enforceBuyPolicy({
    policy,
    collection: "DSNRS",
    maxPrice: 10,
    currency: "APE",
    allowUnsafe: true,
    allowlist: [{ name: "DSNRS", slug: "dsnrs", contractAddress: null }],
  });
  assert.equal(res.ok, true);
});

