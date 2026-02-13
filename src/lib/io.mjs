import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function readJson(filePath, fallback = null) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export function appendJsonl(filePath, payload) {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, `${JSON.stringify(payload)}\n`);
}

export function nowIso() {
  return new Date().toISOString();
}

export function randomId(prefix = "id") {
  const body = randomUUID().replace(/-/g, "").slice(0, 12);
  return `${prefix}_${body}`;
}

