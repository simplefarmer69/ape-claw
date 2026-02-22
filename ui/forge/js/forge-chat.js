/**
 * forge-chat.js — Agent chat panel for ClawBot Forge.
 *
 * Gateway mode:
 * - Forge always uses /api/forge/chat (OpenClaw gateway takeover path)
 * - No fallback to legacy /api/chat relay
 */

/* ══════════════════════════════════════════════════════════
   DOM refs
   ══════════════════════════════════════════════════════════ */
const msgBox = () => document.getElementById("forgeChatMessages");
const input = () => document.getElementById("forgeChatInput");
const sendBtn = () => document.getElementById("forgeChatSendBtn");
const counter = () => document.getElementById("forgeChatCounter");
const badge = () => document.getElementById("forgeChatBadge");
const gatewayChip = () => document.getElementById("forgeGatewayChip");
const gatewayRefreshBtn = () => document.getElementById("forgeGatewayRefresh");
const gatewayRestartBtn = () => document.getElementById("forgeGatewayRestart");

let unread = 0;
let streaming = false;
let forgeAgentAvailable = null; // null = unknown, true/false after probe
let localAgentName = "Agent";
let gatewayPollTimer = null;
let lastMotionIntentAt = 0;

function safeAbortTimeout(ms) {
  if (typeof AbortSignal.timeout === "function") return AbortSignal.timeout(ms);
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

const conversationHistory = [];

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderChatText(raw) {
  let text = String(raw || "");
  // Optional motion directives for Forge scene control (hidden from chat UI).
  text = text.replace(/\[\[MOTION:[^\]]+\]\]/gi, "");
  // Strip common citation markers from provider answers (e.g. [1], [2]).
  text = text.replace(/\[(\d+)\]/g, "");

  // Escape first for safety, then apply a tiny markdown subset.
  let html = escapeHtml(text);

  // Fenced code blocks.
  html = html.replace(/```([\s\S]*?)```/g, (_m, code) => `<pre><code>${code}</code></pre>`);
  // Inline code.
  html = html.replace(/`([^`]+?)`/g, "<code>$1</code>");
  // Bold.
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Basic bullet list support.
  html = html.replace(/(?:^|\n)- (.+?)(?=\n|$)/g, "<li>$1</li>");
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>");

  // Preserve line breaks.
  html = html.replace(/\n/g, "<br>");
  return html;
}

function userAskedForMotion(prompt) {
  const s = String(prompt || "").toLowerCase();
  if (!s) return false;
  return /\b(move|walk|patrol|wander|goto|go to|navigate|step|turn|come here|go there)\b/.test(s);
}

function applyMotionIntentsFromText(raw, opts = {}) {
  const allowActiveMotion = Boolean(opts.allowActiveMotion);
  const s = String(raw || "");
  const intents = [];
  const matches = s.match(/\[\[MOTION:[^\]]+\]\]/gi) || [];
  for (const m of matches) {
    const payload = m.replace(/^\[\[MOTION:/i, "").replace(/\]\]$/, "").trim();
    const upper = payload.toUpperCase();
    if (upper === "HALT") intents.push({ type: "halt" });
    else if (upper === "PATROL") intents.push({ type: "patrol", durationMs: 20000 });
    else if (upper === "WANDER") intents.push({ type: "wander", durationMs: 10000 });
    else if (upper.startsWith("GOTO")) {
      const nums = payload.match(/-?\d+(\.\d+)?/g) || [];
      if (nums.length >= 2) {
        intents.push({ type: "goto", x: Number(nums[0]), z: Number(nums[1]), durationMs: 15000 });
      }
    }
  }
  if (!intents.length) return;
  const setMotion = window.__forgeSetMotionIntent;
  if (typeof setMotion !== "function") return;
  // Stability rule: apply only the final directive in the response.
  // Some model outputs include multiple tags while "thinking", which causes jitter.
  const intent = intents[intents.length - 1];

  // Unless the user explicitly asked for movement, keep posture steady.
  if (!allowActiveMotion && intent.type !== "halt") {
    setMotion({ type: "halt" });
    return;
  }

  // Throttle active motion changes to avoid rapid target resets.
  const now = Date.now();
  if (intent.type !== "halt" && now - lastMotionIntentAt < 5000) return;
  if (intent.type !== "halt") lastMotionIntentAt = now;
  setMotion(intent);
}

/* ══════════════════════════════════════════════════════════
   Environment detection
   ══════════════════════════════════════════════════════════ */
function isWebsiteMode() {
  const host = window.location.hostname;
  return host.includes("apeclaw.ai") || host.includes("vercel.app") || host.includes("railway.app");
}

async function probeForgeAgent() {
  try {
    const res = await fetch("/api/forge/status", { signal: safeAbortTimeout(10000) });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.agentName) localAgentName = data.agentName;
    return data.configured === true;
  } catch {
    return false;
  }
}

async function fetchGatewayStatus() {
  try {
    const res = await fetch("/api/forge/status", { signal: safeAbortTimeout(9000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function setGatewayChip(state, text) {
  const chip = gatewayChip();
  if (!chip) return;
  chip.dataset.state = state;
  chip.textContent = text;
}

async function refreshGatewayChip() {
  const status = await fetchGatewayStatus();
  if (!status) {
    setGatewayChip("err", "Gateway: unreachable");
    return null;
  }
  if (status.gatewayReady || status.configured) {
    setGatewayChip("ok", "Gateway: online");
  } else if (status.gatewayCli) {
    setGatewayChip("warn", "Gateway: starting/idle");
  } else {
    setGatewayChip("err", "Gateway: OpenClaw CLI missing");
  }
  return status;
}

async function runGatewayAction(action) {
  const restart = gatewayRestartBtn();
  const refresh = gatewayRefreshBtn();
  if (restart) restart.disabled = true;
  if (refresh) refresh.disabled = true;
  setGatewayChip("warn", action === "restart" ? "Gateway: restarting..." : "Gateway: updating...");
  try {
    const res = await fetch("/api/forge/gateway/control", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || `HTTP ${res.status}`);
    }
    await refreshGatewayChip();
  } catch (err) {
    setGatewayChip("err", `Gateway: ${err.message}`);
  } finally {
    if (restart) restart.disabled = false;
    if (refresh) refresh.disabled = false;
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
  if (role === "agent") body.innerHTML = renderChatText(text);
  else body.textContent = text;

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
  if (window.__forgeSetSpeaking) window.__forgeSetSpeaking(true);
  const btn = sendBtn();
  if (btn) btn.disabled = true;

  await sendToForgeAgent(text);
}

/* ══════════════════════════════════════════════════════════
   Forge agent: POST /api/forge/chat (SSE stream)
   ══════════════════════════════════════════════════════════ */
async function sendToForgeAgent(text) {
  const btn = sendBtn();
  const bodyEl = appendMsg("agent", "");
  let buffer = "";
  let firstChunkSeen = false;
  let pendingTimer = null;
  const pendingStartedAt = Date.now();

  function renderPending() {
    if (!bodyEl || firstChunkSeen) return;
    const sec = Math.max(0, Math.floor((Date.now() - pendingStartedAt) / 1000));
    const stage = sec < 5
      ? "Analyzing request..."
      : sec < 12
        ? "Checking OpenClaw context..."
        : "Waiting for gateway response...";
    bodyEl.classList.add("chat-pending");
    bodyEl.innerHTML = `
      <span class="chat-pending-wrap">
        <span class="chat-pending-label">OpenClaw agent is responding</span>
        <span class="chat-pending-dots"><i></i><i></i><i></i></span>
        <span class="chat-pending-stage">${stage}</span>
        <span class="chat-pending-time">${sec}s</span>
      </span>
    `;
  }

  function stopPending() {
    firstChunkSeen = true;
    if (pendingTimer) {
      clearInterval(pendingTimer);
      pendingTimer = null;
    }
    if (bodyEl) bodyEl.classList.remove("chat-pending");
  }

  renderPending();
  pendingTimer = setInterval(renderPending, 700);

  try {
    async function requestOnce() {
      return fetch("/api/forge/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: conversationHistory.slice(-20),
        }),
        signal: safeAbortTimeout(150000),
      });
    }

    let res = await requestOnce();
    if (!res.ok && (res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504)) {
      const waitMs = 500;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      res = await requestOnce();
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      let errMsg = errData.error || errData.message || res.statusText || `HTTP ${res.status}`;
      if (errData.status && !String(errMsg).includes(String(errData.status))) {
        errMsg += ` (${errData.status})`;
      }
      if (errData.retryAfter) {
        errMsg += `, retry in ${errData.retryAfter}s`;
      }
      stopPending();
      if (bodyEl) bodyEl.textContent = `Error: ${errMsg}`;
      finishStreaming();
      return;
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/event-stream")) {
      const data = await res.json().catch(() => ({}));
      stopPending();
      if (bodyEl) bodyEl.innerHTML = renderChatText(data.reply || data.message || "No response");
      if (data.reply || data.message) {
        const replyText = data.reply || data.message;
        applyMotionIntentsFromText(replyText, { allowActiveMotion: userAskedForMotion(text) });
        conversationHistory.push({ role: "assistant", content: replyText });
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
            if (!firstChunkSeen) stopPending();
            buffer += t;
            if (bodyEl) bodyEl.innerHTML = renderChatText(buffer);
            const box = msgBox();
            if (box) box.scrollTop = box.scrollHeight;
          }
        } catch { /* ignore parse errors */ }
      }
    }

    stopPending();
    if (buffer) {
      applyMotionIntentsFromText(buffer, { allowActiveMotion: userAskedForMotion(text) });
      conversationHistory.push({ role: "assistant", content: buffer });
    } else if (bodyEl && !bodyEl.textContent) {
      bodyEl.textContent = "No response received";
    }
  } catch (err) {
    stopPending();
    if (bodyEl) {
      let msg = buffer;
      if (!msg) {
        if (err.name === "TimeoutError" || err.name === "AbortError") {
          msg = "The agent is still working (browser/tool operations can take up to 2 minutes). Try again or check the OpenClaw gateway dashboard for results.";
        } else {
          msg = `Connection error: ${err.message}`;
        }
      }
      bodyEl.innerHTML = renderChatText(msg);
    }
  }

  finishStreaming();
}

function finishStreaming() {
  streaming = false;
  if (window.__forgeSetSpeaking) window.__forgeSetSpeaking(false);
  const btn = sendBtn();
  if (btn) btn.disabled = false;
  input()?.focus();
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
  const refreshBtn = gatewayRefreshBtn();
  const restartBtn = gatewayRestartBtn();

  refreshBtn?.addEventListener("click", async () => { await refreshGatewayChip(); });
  restartBtn?.addEventListener("click", async () => { await runGatewayAction("restart"); });

  if (isWebsiteMode()) {
    refreshBtn?.setAttribute("style", "display:none");
    restartBtn?.setAttribute("style", "display:none");
    setGatewayChip("ok", "Gateway: main session");
    forgeAgentAvailable = true;
    if (inp) inp.disabled = false;
    if (btn) btn.disabled = false;
    if (inp) inp.placeholder = "Ask The Clawllector anything...";
    if (indicator) {
      indicator.textContent = "Connected via OpenClaw Gateway (main session)";
      indicator.style.display = "block";
    }
  } else {
    const status = await fetchGatewayStatus();
    let warmedStatus = status;
    if (!status?.configured) {
      // First-run recovery: auto-attempt gateway restart once before warning.
      await runGatewayAction("restart");
      warmedStatus = await fetchGatewayStatus();
    }
    forgeAgentAvailable = Boolean(warmedStatus?.configured || (await probeForgeAgent()));
    if (warmedStatus?.agentName) localAgentName = warmedStatus.agentName;

    if (forgeAgentAvailable) {
      if (inp) { inp.disabled = false; inp.placeholder = `Ask ${localAgentName} anything...`; }
      if (btn) btn.disabled = false;
      if (indicator) {
        indicator.textContent = "Connected via OpenClaw Gateway (main session)";
        indicator.style.display = "block";
      }
    } else {
      if (inp) inp.disabled = false;
      if (btn) btn.disabled = false;
      if (indicator) {
        indicator.innerHTML =
          '\u{26A0}\uFE0F OpenClaw Gateway not ready. Start/restart gateway, then retry. ' +
          '<code style="color:var(--neon-cyan,#63d7ff)">openclaw gateway start</code>';
        indicator.style.display = "block";
      }
    }
  }

  if (!isWebsiteMode()) {
    await refreshGatewayChip();
    if (gatewayPollTimer) clearInterval(gatewayPollTimer);
    gatewayPollTimer = setInterval(() => {
      refreshGatewayChip().catch(() => {});
    }, 20_000);
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

  document.querySelectorAll(".forge-chat-quick-btn").forEach((el) => {
    el.addEventListener("click", () => {
      const prompt = String(el.getAttribute("data-prompt") || "").trim();
      if (!prompt) return;
      const inp = input();
      if (!inp) return;
      inp.value = prompt;
      updateCounter();
      sendMessage();
    });
  });

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
