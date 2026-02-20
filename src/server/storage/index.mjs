/**
 * Storage abstraction layer.
 *
 * Exports a singleton that wraps the active backend (file or SQLite).
 * All route handlers go through this interface so the backend can be swapped.
 *
 * Backend selection: set APE_CLAW_STORAGE=sqlite to use SQLite.
 * Default: file-based (original behavior).
 *
 * Also exports an EventEmitter that fires on mutations:
 *   'telemetryEvent' (evt)  -- new telemetry event stored
 *   'chatMessage' (msg)     -- new chat message/reaction stored
 */

import { EventEmitter } from "node:events";
import { createFileBackend } from "./file-backend.mjs";
import { createSqliteBackend } from "./sqlite-backend.mjs";

export const storageEvents = new EventEmitter();
storageEvents.setMaxListeners(1000);

let _backend = null;

export function initStorage(opts = {}) {
  const storageType = String(opts.type || process.env.APE_CLAW_STORAGE || "file").toLowerCase();
  if (storageType === "sqlite") {
    _backend = createSqliteBackend(opts);
  } else {
    _backend = createFileBackend(opts);
  }
  return _backend;
}

export function getStorage() {
  if (!_backend) throw new Error("Storage not initialized. Call initStorage() first.");
  return _backend;
}
