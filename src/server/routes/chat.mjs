/**
 * Routes: /api/chat/*, /api/chat/stream (SSE)
 */

import { getStorage } from "../storage/index.mjs";
import { addChatClient } from "../sse.mjs";
import { resolveChatAuth } from "../middleware/auth.mjs";
import { collectBody } from "../middleware/body-limit.mjs";

function normalizeRoomName(input) {
  const raw = String(input || "general").toLowerCase().trim()
    .replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return raw || "general";
}

function materializeChatMessages(entries, room = "all") {
  const targetRoom = normalizeRoomName(room);
  const byId = new Map();
  const ordered = [];

  for (const e of entries) {
    if (String(e.type || "message") !== "message") continue;
    const msg = {
      id: e.id, type: "message", agentId: e.agentId, agentName: e.agentName,
      identityProvider: e.identityProvider, identityMeta: e.identityMeta || {},
      room: normalizeRoomName(e.room || "general"), text: e.text, ts: e.ts,
      replyTo: e.replyTo || null, reactions: {}, reactionUsers: {},
    };
    byId.set(msg.id, msg);
    ordered.push(msg);
  }

  for (const e of entries) {
    if (String(e.type || "") !== "reaction") continue;
    const msg = byId.get(e.messageId);
    if (!msg) continue;
    const emoji = String(e.emoji || "").trim();
    const agentId = String(e.agentId || "").trim();
    if (!emoji || !agentId) continue;
    const current = new Set(msg.reactionUsers[emoji] || []);
    if (current.has(agentId)) current.delete(agentId);
    else current.add(agentId);
    msg.reactionUsers[emoji] = [...current];
    msg.reactions[emoji] = msg.reactionUsers[emoji].length;
  }

  return targetRoom === "all" ? ordered : ordered.filter((m) => normalizeRoomName(m.room) === targetRoom);
}

export function handleChatStream(req, res, reqUrl) {
  const room = normalizeRoomName(reqUrl.searchParams.get("room") || "all");
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });
  res.write("\n");
  const remove = addChatClient(res, room);
  req.on("close", remove);
}

export function handleChatGet(req, res, reqUrl) {
  const store = getStorage();
  const room = normalizeRoomName(reqUrl.searchParams.get("room") || "all");
  const limit = Math.max(1, Math.min(500, Number(reqUrl.searchParams.get("limit") || 100)));
  const entries = store.readChatEntries();
  const messages = materializeChatMessages(entries, room).slice(-limit);
  res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  return res.end(JSON.stringify({ room, limit, messages }));
}

export function handleChatRooms(req, res, reqUrl) {
  const store = getStorage();
  const limit = Math.max(1, Math.min(200, Number(reqUrl.searchParams.get("limit") || 50)));
  const parsed = materializeChatMessages(store.readChatEntries(), "all");
  const byRoom = new Map();
  for (const m of parsed) {
    const room = normalizeRoomName(m.room || "general");
    const prev = byRoom.get(room) || { room, count: 0, lastTs: null, lastMessage: "", participants: new Set() };
    prev.count += 1;
    prev.lastTs = m.ts || prev.lastTs;
    prev.lastMessage = m.text || prev.lastMessage;
    if (m.agentId) prev.participants.add(m.agentId);
    byRoom.set(room, prev);
  }
  const rooms = [...byRoom.values()]
    .map((r) => ({ room: r.room, count: r.count, lastTs: r.lastTs, lastMessage: r.lastMessage, participants: r.participants.size }))
    .sort((a, b) => String(b.lastTs || "").localeCompare(String(a.lastTs || "")))
    .slice(0, limit);
  res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  return res.end(JSON.stringify({ count: rooms.length, rooms }));
}

export async function handleChatPost(req, res, reqUrl) {
  const raw = await collectBody(req, res);
  if (raw === null) return;
  try {
    const body = JSON.parse(raw);
    const store = getStorage();
    const room = normalizeRoomName(body.room || reqUrl.searchParams.get("room") || "general");
    const text = String(body.text || "").trim();
    const replyTo = String(body.replyTo || "").trim();

    if (!text || text.length > 500) {
      res.writeHead(400, { "content-type": "application/json" });
      return res.end(JSON.stringify({ error: "message must be 1-500 characters" }));
    }
    const authRes = await resolveChatAuth(req, body);
    if (!authRes.ok) {
      res.writeHead(authRes.status || 403, { "content-type": "application/json" });
      return res.end(JSON.stringify({ error: authRes.error, reason: authRes.reason }));
    }
    const auth = authRes.auth;

    if (replyTo) {
      const existing = materializeChatMessages(store.readChatEntries(), room);
      const parent = existing.find((m) => m.id === replyTo);
      if (!parent) {
        res.writeHead(400, { "content-type": "application/json" });
        return res.end(JSON.stringify({ error: "reply target not found in this room" }));
      }
    }

    const msg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: "message", agentId: auth.id, agentName: auth.name,
      identityProvider: auth.provider, identityMeta: auth.meta,
      room, text, replyTo: replyTo || null, reactions: {}, reactionUsers: {},
      ts: new Date().toISOString(),
    };
    store.appendChat(msg);

    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: true, message: msg }));
  } catch {
    res.writeHead(400, { "content-type": "application/json" });
    return res.end(JSON.stringify({ error: "invalid JSON body" }));
  }
}

export async function handleChatReact(req, res, reqUrl) {
  const raw = await collectBody(req, res);
  if (raw === null) return;
  try {
    const body = JSON.parse(raw);
    const store = getStorage();
    const room = normalizeRoomName(body.room || reqUrl.searchParams.get("room") || "general");
    const messageId = String(body.messageId || "").trim();
    const emoji = String(body.emoji || "").trim().slice(0, 8);
    if (!messageId || !emoji) {
      res.writeHead(400, { "content-type": "application/json" });
      return res.end(JSON.stringify({ error: "messageId and emoji are required" }));
    }
    const authRes = await resolveChatAuth(req, body);
    if (!authRes.ok) {
      res.writeHead(authRes.status || 403, { "content-type": "application/json" });
      return res.end(JSON.stringify({ error: authRes.error, reason: authRes.reason }));
    }
    const auth = authRes.auth;
    const existing = materializeChatMessages(store.readChatEntries(), room);
    const parent = existing.find((m) => m.id === messageId);
    if (!parent) {
      res.writeHead(404, { "content-type": "application/json" });
      return res.end(JSON.stringify({ error: "message not found in this room" }));
    }
    const evt = {
      id: `react_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: "reaction", room, messageId, emoji,
      agentId: auth.id, agentName: auth.name, ts: new Date().toISOString(),
    };
    store.appendChat(evt);
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: true, reaction: evt }));
  } catch {
    res.writeHead(400, { "content-type": "application/json" });
    return res.end(JSON.stringify({ error: "invalid JSON body" }));
  }
}
