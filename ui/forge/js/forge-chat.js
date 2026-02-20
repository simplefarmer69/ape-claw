/**
 * forge-chat.js — Agent chat panel for ClawBot Forge.
 *
 * Three modes (auto-detected):
 * 1. Website (apeclaw.ai / vercel.app): always uses /api/forge/chat (The Clawllector)
 * 2. Local + PERPLEXITY_API_KEY set: uses /api/forge/chat (your own OpenClaw agent)
 * 3. Local without key: falls back to /api/chat (basic message relay)
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
let forgeAgentAvailable = null; // null = unknown, true/false after probe
let localAgentName = "Agent";
let localProvider = "";

const conversationHistory = [];

/* ══════════════════════════════════════════════════════════
   Environment detection
   ══════════════════════════════════════════════════════════ */
function isWebsiteMode() {
  const host = window.location.hostname;
  return host.includes("apeclaw.ai") || host.includes("vercel.app") || host.includes("railway.app");
}

async function probeForgeAgent() {
  try {
    const res = await fetch("/api/forge/status", { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.agentName) localAgentName = data.agentName;
    if (data.provider) localProvider = data.provider;
    return data.configured === true;
  } catch {
    return false;
  }
}

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
  if (role === "user") {
    name.textContent = "You";
  } else if (isWebsiteMode()) {
    name.textContent = "The Clawllector";
  } else {
    name.textContent = forgeAgentAvailable ? localAgentName : "Agent";
  }
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
   Send message — routes to the right endpoint
   ══════════════════════════════════════════════════════════ */
async function sendMessage() {
  const inp = input();
  const text = inp?.value?.trim();
  if (!text || streaming) return;

  appendMsg("user", text);
  conversationHistory.push({ role: "user", content: text });
  inp.value = "";
  updateCounter();

  streaming = true;
  const btn = sendBtn();
  if (btn) btn.disabled = true;

  if (isWebsiteMode() || forgeAgentAvailable) {
    await sendToForgeAgent(text);
  } else {
    await sendToLocalChat(text);
  }
}

/* ══════════════════════════════════════════════════════════
   Forge agent: POST /api/forge/chat (SSE stream)
   ══════════════════════════════════════════════════════════ */
async function sendToForgeAgent(text) {
  const btn = sendBtn();
  const bodyEl = appendMsg("agent", "");
  let buffer = "";

  try {
    const res = await fetch("/api/forge/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: text,
        history: conversationHistory.slice(-20),
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errMsg = errData.error || errData.message || res.statusText || `HTTP ${res.status}`;
      if (bodyEl) bodyEl.textContent = `Error: ${errMsg}`;
      finishStreaming();
      return;
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/event-stream")) {
      const data = await res.json().catch(() => ({}));
      if (bodyEl) bodyEl.textContent = data.reply || data.message || "No response";
      if (data.reply || data.message) {
        conversationHistory.push({ role: "assistant", content: data.reply || data.message });
      }
      finishStreaming();
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      sseBuffer += decoder.decode(value, { stream: true });
      const lines = sseBuffer.split("\n");
      sseBuffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        try {
          const chunk = JSON.parse(data);
          const t = chunk.text || chunk.content || "";
          if (t) {
            buffer += t;
            if (bodyEl) bodyEl.textContent = buffer;
            const box = msgBox();
            if (box) box.scrollTop = box.scrollHeight;
          }
        } catch { /* ignore parse errors */ }
      }
    }

    if (buffer) {
      conversationHistory.push({ role: "assistant", content: buffer });
    } else if (bodyEl && !bodyEl.textContent) {
      bodyEl.textContent = "No response received";
    }
  } catch (err) {
    if (bodyEl) bodyEl.textContent = buffer || `Connection error: ${err.message}`;
  }

  finishStreaming();
}

/* ══════════════════════════════════════════════════════════
   Local fallback: POST /api/chat (basic message relay)
   ══════════════════════════════════════════════════════════ */
async function sendToLocalChat(text) {
  const btn = sendBtn();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, room: "forge" }),
    });

    if (!res.ok) {
      appendMsg("agent", `Error: ${res.status} ${res.statusText}`);
      finishStreaming();
      return;
    }

    const data = await res.json();
    if (data.reply) {
      appendMsg("agent", data.reply);
    } else if (data.streamId) {
      streamResponse(data.streamId);
      return;
    } else {
      appendMsg("agent", data.message?.text || "Message sent");
    }
  } catch (err) {
    appendMsg("agent", `Connection error: ${err.message}`);
  }

  finishStreaming();
}

function finishStreaming() {
  streaming = false;
  const btn = sendBtn();
  if (btn) btn.disabled = false;
  input()?.focus();
}

/* ══════════════════════════════════════════════════════════
   SSE streaming for local mode long responses
   ══════════════════════════════════════════════════════════ */
function streamResponse(streamId) {
  const bodyEl = appendMsg("agent", "");
  const evtSrc = new EventSource(`/api/chat/stream?id=${encodeURIComponent(streamId)}`);
  let buffer = "";

  evtSrc.onmessage = (e) => {
    if (e.data === "[DONE]") {
      evtSrc.close();
      finishStreaming();
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
    finishStreaming();
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
async function init() {
  const inp = input();
  const btn = sendBtn();
  const indicator = document.getElementById("forgeChatAgentIndicator");

  if (isWebsiteMode()) {
    forgeAgentAvailable = true;
    if (inp) inp.disabled = false;
    if (btn) btn.disabled = false;
    if (inp) inp.placeholder = "Ask The Clawllector anything...";
    if (indicator) {
      indicator.textContent = "\u{1F99E} Talking to The Clawllector (OpenClaw agent)";
      indicator.style.display = "block";
    }
  } else {
    forgeAgentAvailable = await probeForgeAgent();

    if (forgeAgentAvailable) {
      if (inp) { inp.disabled = false; inp.placeholder = `Ask ${localAgentName} anything...`; }
      if (btn) btn.disabled = false;
      if (indicator) {
        const providerTag = localProvider ? ` via ${localProvider}` : "";
        indicator.textContent = `\u{1F99E} Connected to ${localAgentName}${providerTag}`;
        indicator.style.display = "block";
      }
    } else {
      if (inp) inp.disabled = true;
      if (btn) btn.disabled = true;
      if (indicator) {
        indicator.innerHTML =
          '\u{1F512} Forge agent not configured. Set an LLM API key ' +
          '(<code style="color:var(--neon-cyan,#63d7ff)">OPENAI_API_KEY</code>, ' +
          '<code style="color:var(--neon-cyan,#63d7ff)">ANTHROPIC_API_KEY</code>, ' +
          '<code style="color:var(--neon-cyan,#63d7ff)">PERPLEXITY_API_KEY</code>, ' +
          'or <code style="color:var(--neon-cyan,#63d7ff)">OLLAMA_HOST</code>) to enable. ' +
          '<a href="/docs" style="color:var(--accent,#cfff04)">Setup guide</a>';
        indicator.style.display = "block";
      }
    }
  }

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
