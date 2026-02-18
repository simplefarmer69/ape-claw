import fs from "node:fs";
import path from "node:path";

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyDir(srcDir, dstDir) {
  ensureDir(dstDir);
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const e of entries) {
    const src = path.join(srcDir, e.name);
    const dst = path.join(dstDir, e.name);
    if (e.isDirectory()) copyDir(src, dst);
    else fs.copyFileSync(src, dst);
  }
}

export function initPodWorkspace({ targetDir, templatesDir }) {
  if (!targetDir) throw new Error("targetDir required");
  if (!templatesDir) throw new Error("templatesDir required");
  const absTarget = path.resolve(targetDir);
  const absTemplates = path.resolve(templatesDir);
  if (!fs.existsSync(absTemplates)) throw new Error(`missing templates: ${absTemplates}`);
  ensureDir(absTarget);
  copyDir(absTemplates, absTarget);
  // Ensure the revenue-sharing agreement exists even if templates are old/partial.
  const rev = path.join(absTarget, "REVENUE_SHARING.md");
  if (!fs.existsSync(rev)) {
    fs.writeFileSync(rev, [
      "# REVENUE_SHARING.md (THE POD)",
      "",
      "When an agent installs/uses onchain skills in this Pod, it agrees to route skill-related revenue",
      "to the Pod's shared receiver (e.g. PodVault) and share among Pod members.",
      "",
    ].join("\n"));
  }
  return { ok: true, targetDir: absTarget };
}

