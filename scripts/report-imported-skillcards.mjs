import fs from "node:fs";
import path from "node:path";

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function inc(map, k, by = 1) {
  const key = String(k || "unknown");
  map[key] = (map[key] || 0) + by;
}

function main() {
  const indexPath = path.resolve(process.cwd(), "skillcards", "imported", "index.json");
  if (!fs.existsSync(indexPath)) {
    console.error(`Missing ${indexPath}. Run: npm run skillcards:import`);
    process.exit(2);
  }
  const j = readJson(indexPath);
  const imported = Array.isArray(j.imported) ? j.imported : [];
  const quarantined = Array.isArray(j.quarantined) ? j.quarantined : [];

  const counts = {
    total: imported.length,
    importOk: imported.filter((x) => x && x.importOk).length,
    vettedOk: imported.filter((x) => x && (x.vettedOk === true || x?.vetted?.ok === true)).length,
    quarantined: quarantined.length,
    publishedKnown: Array.isArray(j.published) ? j.published.length : 0,
  };

  const bySource = {};
  const byVerdict = {};
  const bySignal = {};

  for (const it of imported) {
    if (!it || typeof it !== "object") continue;
    inc(bySource, it.source || "unknown");
    const v = it.vetted || {};
    inc(byVerdict, v.verdict || (it.vettedOk ? "allow" : "unknown"));
    const sigs = Array.isArray(v.signals) ? v.signals : [];
    for (const s of sigs) inc(bySignal, s);
  }

  const topSignals = Object.entries(bySignal)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([signal, count]) => ({ signal, count }));

  const out = {
    ok: true,
    index: indexPath,
    generatedAt: new Date().toISOString(),
    counts,
    bySource,
    byVerdict,
    topSignals,
    quarantinedSample: quarantined.slice(0, 25).map((x) => ({
      slug: x.slug,
      name: x.name,
      source: x.source,
      sourceUrl: x.sourceUrl,
      verdict: x?.vetted?.verdict || null,
      signals: x?.vetted?.signals || [],
      fileName: x.fileName,
    })),
  };

  console.log(JSON.stringify(out, null, 2));
}

main();

