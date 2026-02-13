function toSlug(input) {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/®/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

async function fetchJson(url, headers = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} for ${url}${body ? `: ${body.slice(0, 180)}` : ""}`);
  }
  return res.json();
}

function extractContractAddress(collectionPayload) {
  const contracts = collectionPayload?.contracts;
  if (Array.isArray(contracts) && contracts.length > 0) {
    const ape = contracts.find((c) => String(c?.chain || "").toLowerCase() === "apechain");
    return (ape?.address || contracts[0]?.address || null);
  }
  const fallback = collectionPayload?.contract || collectionPayload?.primary_contract;
  if (fallback && typeof fallback === "object") return fallback.address || null;
  return null;
}

function extractContractFromNftPayload(nftPayload) {
  const nfts = nftPayload?.nfts || [];
  if (!Array.isArray(nfts) || nfts.length === 0) return null;
  const first = nfts[0] || {};
  const c = first?.contract;
  if (c && typeof c === "object") return c.address || null;
  const contracts = first?.contracts;
  if (Array.isArray(contracts) && contracts.length > 0) return contracts[0]?.address || null;
  return null;
}

function buildSlugCandidates(item, overrides = {}) {
  const raw = String(item.name || "");
  const base = toSlug(raw);
  const fromOverride = overrides[raw] || overrides[base] || [];
  const variants = [
    item.slug,
    base,
    base.replace(/-on-apechain$/, ""),
    base.replace(/-on-ape$/, ""),
    base.replace(/-the-level-up$/, ""),
    base.replace(/-/g, ""),
    toSlug(raw.replace(/_/g, " ")),
    toSlug(raw.replace(/:/g, " ")),
    ...(Array.isArray(fromOverride) ? fromOverride : [fromOverride]),
  ];
  return unique(variants);
}

async function resolveOpenSeaCollection(item, headers, overrides = {}) {
  const candidates = buildSlugCandidates(item, overrides);
  const notes = [];
  for (const slug of candidates) {
    // 1) Try collection metadata endpoint
    try {
      const data = await fetchJson(
        `https://api.opensea.io/api/v2/collections/${encodeURIComponent(slug)}`,
        headers,
      );
      const collection = data?.collection || data;
      const ca = extractContractAddress(collection);
      if (ca) return { slug, contractAddress: ca, notes: [`resolved via get_collection slug=${slug}`] };
      notes.push(`slug ${slug}: collection found but no contract field`);
    } catch (err) {
      notes.push(`slug ${slug}: get_collection failed (${err.message})`);
    }

    // 2) Fallback: try NFTs-by-collection and derive contract from first NFT
    try {
      const nftsData = await fetchJson(
        `https://api.opensea.io/api/v2/collection/${encodeURIComponent(slug)}/nfts?limit=1`,
        headers,
      );
      const ca = extractContractFromNftPayload(nftsData);
      if (ca) return { slug, contractAddress: ca, notes: [`resolved via get_nfts_by_collection slug=${slug}`] };
      notes.push(`slug ${slug}: nfts endpoint returned no contract`);
    } catch (err) {
      notes.push(`slug ${slug}: get_nfts_by_collection failed (${err.message})`);
    }
  }
  return { slug: item.slug || toSlug(item.name), contractAddress: null, notes };
}

export async function enrichAllowlistWithOpenSea(allowlist, apiKey, overrides = {}) {
  if (!apiKey) return { allowlist, notes: ["OpenSea key not provided; skipped enrichment."] };
  const headers = { "x-api-key": apiKey, accept: "application/json" };
  const notes = [];
  const out = [];
  for (const item of allowlist) {
    if (item.contractAddress) {
      out.push(item);
      continue;
    }
    try {
      const resolved = await resolveOpenSeaCollection(item, headers, overrides);
      const ca = resolved.contractAddress;
      if (ca) {
        out.push({ ...item, slug: resolved.slug, contractAddress: ca });
        notes.push(`resolved ${item.name} -> ${ca} (slug=${resolved.slug})`);
      } else {
        out.push(item);
        notes.push(`no CA found for ${item.name}`);
        notes.push(...resolved.notes.map((n) => `  ${n}`));
      }
    } catch (err) {
      out.push(item);
      notes.push(`OpenSea lookup failed for ${item.name}: ${err.message}`);
    }
  }
  return { allowlist: out, notes };
}

export async function getListings({
  collection,
  tokenId,
  maxPrice,
  dataSource,
  apiKey,
  slugOverrides = {},
}) {
  const source = String(dataSource || "reservoir").toLowerCase();
  if (source !== "opensea") {
    throw new Error(
      `Unsupported market data source '${source}' for live mode. Set market.dataSource to 'opensea'.`,
    );
  }

  if (!apiKey) {
    throw new Error("OpenSea data source selected but OPENSEA_API_KEY is missing.");
  }

  const candidates = buildSlugCandidates({ name: collection, slug: toSlug(collection) }, slugOverrides);
  let slug = candidates[0];
  const headers = { "x-api-key": apiKey, accept: "application/json" };

  let data = null;
  let endpoint = "";
  for (const s of candidates) {
    try {
      const urls = tokenId
        ? [
            `https://api.opensea.io/api/v2/listings/collection/${encodeURIComponent(s)}/nfts/${encodeURIComponent(String(tokenId))}/all?limit=20`,
            `https://api.opensea.io/api/v2/listings/collection/${encodeURIComponent(s)}/all?limit=50`,
          ]
        : [`https://api.opensea.io/api/v2/listings/collection/${encodeURIComponent(s)}/all?limit=20`];
      for (const listingsUrl of urls) {
        try {
          data = await fetchJson(listingsUrl, headers);
          slug = s;
          endpoint = listingsUrl;
          break;
        } catch {
          // try next endpoint variant
        }
      }
      if (data) break;
    } catch {
      // try next candidate slug
    }
  }
  if (!data) {
    throw new Error(`OpenSea collection not found for any slug candidate: ${candidates.join(", ")}`);
  }
  const rawListings = data?.listings || data?.orders || [];
  const listings = rawListings.map((l, idx) => {
    const wei =
      l?.price?.current?.value ||
      l?.current_price ||
      l?.price?.value ||
      l?.protocol_data?.parameters?.consideration?.[0]?.startAmount ||
      "0";
    const priceApe = Number((Number(wei) / 1e18).toFixed(6));
    const tid = String(
      l?.protocol_data?.parameters?.offer?.[0]?.identifierOrCriteria ||
      l?.protocol_data?.parameters?.consideration?.[0]?.identifierOrCriteria ||
      l?.asset?.token_id ||
      tokenId ||
      idx + 1,
    );
    return {
      listingId: String(l?.order_hash || l?.id || `os_${idx}`),
      orderHash: String(l?.order_hash || l?.id || `os_${idx}`),
      collection: slug,
      tokenId: tid,
      priceApe,
      currency: "APE",
      source: "opensea",
      protocolAddress: String(
        l?.protocol_address ||
          l?.protocolData?.protocol_address ||
          "0x0000000000000068f116a894984e2db1123eb395",
      ),
      assetContractAddress: String(
        l?.protocol_data?.parameters?.offer?.[0]?.token ||
          l?.asset?.asset_contract?.address ||
          "",
      ),
      chainSlug: "ape_chain",
      expiresAt: l?.expiration_time
        ? new Date(Number(l.expiration_time) * 1000).toISOString()
        : null,
      protocolData: l?.protocol_data || null,
    };
  });

  const filteredByToken = tokenId
    ? listings.filter((l) => String(l.tokenId) === String(tokenId))
    : listings;

  return {
    source: "opensea",
    listings: filteredByToken.filter((l) => Number(l.priceApe) <= Number(maxPrice)),
    notes: [
      "Listings fetched from OpenSea live listings endpoint.",
      `Resolved slug: ${slug}`,
      `Endpoint: ${endpoint}`,
    ],
  };
}

