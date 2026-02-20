import fs from "node:fs";
import path from "node:path";
import { keccak256, toHex } from "viem";

export function stableJsonStringify(obj) {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(stableJsonStringify).join(",")}]`;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJsonStringify(obj[k])}`).join(",")}}`;
}

export function computeSkillcardContentHash(skillcardObj) {
  const canon = stableJsonStringify(skillcardObj);
  return keccak256(toHex(canon));
}

export function computeSkillVersionHash(versionString) {
  const v = String(versionString || "").trim() || "0.0.0";
  return keccak256(toHex(v));
}

export function readSkillcardJson(filePath) {
  const resolved = path.resolve(filePath);
  if (resolved.includes("\0")) throw new Error("invalid file path");
  const cwd = path.resolve(process.cwd());
  if (!resolved.startsWith(cwd + path.sep) && resolved !== cwd) {
    throw new Error(`file must be under the current working directory (got ${resolved})`);
  }
  const raw = fs.readFileSync(resolved, "utf8");
  const obj = JSON.parse(raw);
  if (!obj || typeof obj !== "object") throw new Error("invalid skillcard json");
  return obj;
}

