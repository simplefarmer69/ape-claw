/**
 * SSE (Server-Sent Events) client management.
 *
 * Listens to the storage EventEmitter for new events and broadcasts
 * to connected SSE clients. Works with any storage backend.
 *
 * Supports Last-Event-ID for reconnection gap-fill.
 */

import { storageEvents } from "./storage/index.mjs";

const telemetryClients = new Set();
const chatClients = new Set();

let _eventCounter = Date.now();

export function nextEventId() {
  return ++_eventCounter;
}

function sendSse(res, data, id) {
  try {
    if (id !== undefined) res.write(`id: ${id}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch { /* client disconnected */ }
}

export function addTelemetryClient(res) {
  telemetryClients.add(res);
  return () => telemetryClients.delete(res);
}

export function addChatClient(res, room) {
  const client = { res, room };
  chatClients.add(client);
  return () => chatClients.delete(client);
}

export function broadcastTelemetry(evt) {
  const id = nextEventId();
  for (const c of telemetryClients) sendSse(c, evt, id);
}

function normalizeRoom(r) {
  return String(r || "general").toLowerCase().trim()
    .replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "general";
}

export function broadcastChat(msg) {
  const id = nextEventId();
  for (const client of chatClients) {
    try {
      const want = normalizeRoom(client.room || "all");
      if (want !== "all" && want !== normalizeRoom(msg.room)) continue;
      sendSse(client.res, msg, id);
    } catch { chatClients.delete(client); }
  }
}

export function getTelemetryClientCount() { return telemetryClients.size; }
export function getChatClientCount() { return chatClients.size; }

export function closeAllClients() {
  for (const c of telemetryClients) { try { c.end(); } catch {} }
  telemetryClients.clear();
  for (const c of chatClients) { try { c.res.end(); } catch {} }
  chatClients.clear();
}

export function initSseBroadcast() {
  storageEvents.on("telemetryEvent", broadcastTelemetry);
  storageEvents.on("chatMessage", broadcastChat);
}
