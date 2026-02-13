import fs from "node:fs";
import path from "node:path";
import { enrichAllowlistWithOpenSea } from "../src/lib/market.mjs";

const key = process.env.OPENSEA_API_KEY || "";
const filePath = path.join(process.cwd(), "allowlists", "recommended.apechain.json");
const overridesPath = path.join(process.cwd(), "allowlists", "opensea-slug-overrides.json");

if (!key) {
  console.error("OPENSEA_API_KEY is required.");
  process.exit(1);
}

const allowlist = JSON.parse(fs.readFileSync(filePath, "utf8"));
const overrides = fs.existsSync(overridesPath) ? JSON.parse(fs.readFileSync(overridesPath, "utf8")) : {};
const { allowlist: updated, notes } = await enrichAllowlistWithOpenSea(allowlist, key, overrides);
fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));

const resolved = notes.filter((n) => n.startsWith("resolved ")).length;
console.log(`OpenSea CA resolve complete. Resolved ${resolved} entries.`);
for (const n of notes) console.log(n);

