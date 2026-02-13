import { readJson } from "./io.mjs";
import { POLICY_PATH, ALLOWLIST_PATH } from "./paths.mjs";

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "");
}

export function loadPolicy() {
  const policy = readJson(POLICY_PATH, null);
  if (!policy) {
    throw new Error("Missing config/policy.json. Copy config/policy.example.json first.");
  }
  return policy;
}

export function loadAllowlist() {
  const list = readJson(ALLOWLIST_PATH, []);
  return normalizeAllowlist(Array.isArray(list) ? list : []);
}

export function normalizeAllowlist(allowlist) {
  const dedup = new Map();
  for (const item of allowlist) {
    // Dedup by slug or name only — rank is never used as an identity key
    const slug = String(item.slug || "").toLowerCase();
    const name = String(item.name || "").toLowerCase();
    const key = slug || name;
    if (!key) continue; // skip entries with no slug or name
    const existing = dedup.get(key);
    if (!existing) {
      dedup.set(key, item);
      continue;
    }
    const candidateHasCA = Boolean(item.contractAddress);
    const existingHasCA = Boolean(existing.contractAddress);
    if (candidateHasCA && !existingHasCA) dedup.set(key, item);
  }
  return [...dedup.values()];
}

export function resolveCollectionTarget(collection, allowlist) {
  const input = String(collection || "").trim();
  if (!input) return { matches: [], exact: null };
  const needleLower = input.toLowerCase();
  const needleNorm = normalizeKey(input);
  const matches = allowlist.filter((c) => {
    const name = String(c.name || "");
    const slug = String(c.slug || "");
    const ca = String(c.contractAddress || "");
    return (
      needleLower === name.toLowerCase() ||
      needleLower === slug.toLowerCase() ||
      (ca && needleLower === ca.toLowerCase()) ||
      needleNorm === normalizeKey(name) ||
      needleNorm === normalizeKey(slug)
    );
  });
  return { matches, exact: matches.length === 1 ? matches[0] : null };
}

export function enforceBuyPolicy({
  policy,
  collection,
  maxPrice,
  currency,
  allowUnsafe = false,
  allowlist = [],
}) {
  const errors = [];
  const warnings = [];
  const allowedCurrencies = new Set(policy.nftBuy.currencyAllowlist || []);
  const target = resolveCollectionTarget(collection, allowlist);
  if (!allowedCurrencies.has(currency)) {
    errors.push(`Currency ${currency} is not allowed.`);
  }
  if (Number(maxPrice) > Number(policy.nftBuy.maxPricePerTx)) {
    errors.push(`maxPrice exceeds policy maxPricePerTx (${policy.nftBuy.maxPricePerTx}).`);
  }
  if (
    policy.market.collectionAllowlistMode === "recommended-only" &&
    !allowUnsafe &&
    target.matches.length === 0
  ) {
    errors.push(`Collection ${collection} is not in recommended allowlist.`);
  }
  if (target.matches.length > 1 && !allowUnsafe) {
    errors.push(
      `Collection ${collection} is ambiguous (${target.matches.length} matches). Use contract address or unique slug.`,
    );
  }
  if (target.exact && !target.exact.contractAddress && !allowUnsafe) {
    errors.push(
      `Collection ${target.exact.name} has unresolved contractAddress. Resolve CA or pass --allow-unsafe.`,
    );
  }
  if (allowUnsafe) warnings.push("Unsafe override enabled.");
  return { ok: errors.length === 0, errors, warnings, target: target.exact };
}

export function enforceBridgePolicy({ policy, feeBps }) {
  if (Number(feeBps) > Number(policy.bridge.maxBridgeFeeBps)) {
    return {
      ok: false,
      errors: [`Bridge fee ${feeBps} bps exceeds cap ${policy.bridge.maxBridgeFeeBps} bps.`],
    };
  }
  return { ok: true, errors: [] };
}

