/**
 * forge-chat.js — Agent chat panel for ClawBot Forge.
 * Posts to /api/chat, streams responses via SSE at /api/chat/stream.
 */

/* ══════════════════════════════════════════════════════════
   DOM refs
   ══════════════════════════════════════════════════════════ */
const msgBox = () => document.getElementById("forgeChatMessages");
const input = () => document.getElementById("forgeChatInput");
const sendBtn = () => document.getElementById("forgeChatSendBtn");
const counter = () => document.getElementById("forgeChatCounter");
const badge = () => document.getElementById("forgeChatBadge");

let unread = 0;
let streaming = false;

/* ══════════════════════════════════════════════════════════
   Message rendering
   ══════════════════════════════════════════════════════════ */
function appendMsg(role, text) {
  const box = msgBox();
  if (!box) return;

  const empty = box.querySelector(".chat-empty");
  if (empty) empty.remove();

  const el = document.createElement("div");
  el.className = "chat-msg";

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "baseline";
  header.style.gap = "6px";

  const name = document.createElement("span");
  name.className = "chat-msg-name";
  name.textContent = role === "user" ? "You" : "Agent";
  header.appendChild(name);

  const time = document.createElement("span");
  time.className = "chat-msg-time";
  time.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  header.appendChild(time);

  const body = document.createElement("div");
  body.className = "chat-msg-text";
  body.textContent = text;

  el.appendChild(header);
  el.appendChild(body);
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;

  if (role === "agent") {
    unread++;
    const b = badge();
    if (b) b.textContent = String(unread);
  }

  return body;
}

/* ══════════════════════════════════════════════════════════
   Send message via POST /api/chat
   ══════════════════════════════════════════════════════════ */
async function sendMessage() {
  const inp = input();
  const text = inp?.value?.trim();
  if (!text || streaming) return;

  appendMsg("user", text);
  inp.value = "";
  updateCounter();

  streaming = true;
  const btn = sendBtn();
  if (btn) btn.disabled = true;

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: text, room: "forge" }),
    });

    if (!res.ok) {
      appendMsg("agent", `Error: ${res.status} ${res.statusText}`);
      return;
    }

    const data = await res.json();
    if (data.reply) {
      appendMsg("agent", data.reply);
    } else if (data.streamId) {
      streamResponse(data.streamId);
      return;
    } else {
      appendMsg("agent", data.message || "No response");
    }
  } catch (err) {
    appendMsg("agent", `Connection error: ${err.message}`);
  } finally {
    streaming = false;
    if (btn) btn.disabled = false;
    inp?.focus();
  }
}

/* ══════════════════════════════════════════════════════════
   SSE streaming for long responses
   ══════════════════════════════════════════════════════════ */
function streamResponse(streamId) {
  const bodyEl = appendMsg("agent", "");
  const evtSrc = new EventSource(`/api/chat/stream?id=${encodeURIComponent(streamId)}`);
  let buffer = "";

  evtSrc.onmessage = (e) => {
    if (e.data === "[DONE]") {
      evtSrc.close();
      streaming = false;
      const btn = sendBtn();
      if (btn) btn.disabled = false;
      input()?.focus();
      return;
    }
    try {
      const chunk = JSON.parse(e.data);
      buffer += chunk.text || chunk.content || "";
      if (bodyEl) bodyEl.textContent = buffer;
      const box = msgBox();
      if (box) box.scrollTop = box.scrollHeight;
    } catch { /* ignore parse errors */ }
  };

  evtSrc.onerror = () => {
    evtSrc.close();
    if (!buffer && bodyEl) bodyEl.textContent = "Stream interrupted";
    streaming = false;
    const btn = sendBtn();
    if (btn) btn.disabled = false;
  };
}

/* ══════════════════════════════════════════════════════════
   Character counter
   ══════════════════════════════════════════════════════════ */
function updateCounter() {
  const c = counter();
  const inp = input();
  if (c && inp) c.textContent = `${inp.value.length}/500`;
}

/* ══════════════════════════════════════════════════════════
   Init
   ══════════════════════════════════════════════════════════ */
function init() {
  const inp = input();
  const btn = sendBtn();

  if (inp) {
    inp.addEventListener("input", updateCounter);
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  if (btn) {
    btn.addEventListener("click", sendMessage);
  }

  const box = msgBox();
  if (box) {
    box.addEventListener("click", () => {
      unread = 0;
      const b = badge();
      if (b) b.textContent = "0";
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
