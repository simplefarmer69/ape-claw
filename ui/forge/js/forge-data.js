/**
 * forge-data.js — Data layer for ClawBot Forge.
 * Fetches skills, pod status, identity, clawbots.
 * Supports install/uninstall with live robot rebuild.
 * Wires inspector panel, identity plate, skill browser, share-to-X.
 */
import {
  attachmentGroup, energyNetworkGroup, robotGroup, scene,
  captureScreenshot, selectAttachment, camera, controls, css2dRenderer,
  setIdleAnimator, MAT, tweenValue, tweenVector3,
} from "./forge-scene.js";
import {
  buildAttachmentsFromSkills, buildEnergyNetwork,
  makeIdleAnimator, CATEGORY_COLORS, clearAttachments,
} from "./forge-attachments.js";
import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

/* ══════════════════════════════════════════════════════════
   State
   ══════════════════════════════════════════════════════════ */
let skills = [];
let allLibrarySkills = [];
let podStatus = null;
let podFiles = {};
let clawbots = [];
let agentName = "The Clawllector";
let agentRole = "";
let agentSoul = "";
let currentAttachments = [];
let searchPage = 1;
let searchTotal = 0;
const SEARCH_LIMIT = 30;

/* ══════════════════════════════════════════════════════════
   Fetch helpers
   ══════════════════════════════════════════════════════════ */
async function fetchJSON(url, options = {}, config = {}) {
  const retries = Number(config.retries ?? 0);
  const timeoutMs = Number(config.timeoutMs ?? 8000);
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const r = await fetch(url, {
        ...options,
        signal: options.signal || AbortSignal.timeout(timeoutMs),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch {
      if (attempt >= retries) return null;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  return null;
}

function authHeaders() {
  const h = { "content-type": "application/json", accept: "application/json" };
  const id = document.getElementById("forgeAuthAgentId")?.value?.trim();
  const tok = document.getElementById("forgeAuthAgentToken")?.value?.trim();
  if (id && tok) {
    h["x-agent-id"] = id;
    h["x-agent-token"] = tok;
  }
  return h;
}

function saveAuth() {
  const id = document.getElementById("forgeAuthAgentId")?.value?.trim() || "";
  const tok = document.getElementById("forgeAuthAgentToken")?.value?.trim() || "";
  try {
    if (id) localStorage.setItem("forge_agent_id", id);
    if (tok) localStorage.setItem("forge_agent_token", tok);
  } catch {}
}

function loadAuth() {
  try {
    const id = localStorage.getItem("forge_agent_id") || "";
    const tok = localStorage.getItem("forge_agent_token") || "";
    const idEl = document.getElementById("forgeAuthAgentId");
    const tokEl = document.getElementById("forgeAuthAgentToken");
    if (idEl && id) idEl.value = id;
    if (tokEl && tok) tokEl.value = tok;
  } catch {}
}

/* ══════════════════════════════════════════════════════════
   Toast notifications
   ══════════════════════════════════════════════════════════ */
function toast(msg, type = "info", durationMs = 3500) {
  const container = document.getElementById("forgeToasts");
  if (!container) return;
  const el = document.createElement("div");
  el.className = `forge-toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = "forgeToastOut .3s ease forwards";
    setTimeout(() => el.remove(), 300);
  }, durationMs);
}

/* ══════════════════════════════════════════════════════════
   Category inference — the search index often lacks category.
   We infer from slug prefixes and known skill mappings.
   ══════════════════════════════════════════════════════════ */
const SEED_CATEGORIES = {
  "acp-bounty-poll":         "Automation",
  "acp-bounty-post":         "Automation",
  "acp-browse":              "Analytics",
  "acp-fulfill-and-route":   "DeFi",
  "apeclaw-bridge-relay":    "Bridge",
  "apeclaw-nft-autobuy":     "NFT",
  "apeclaw-receipt-recorder":"Security",
  "humanizer":               "Writing",
  "otherside-navigator":     "Automation",
  "stonkbrokers-launcher":   "Trading",
  "walkie-p2p":              "Communication",
};

const SLUG_PREFIX_CATEGORIES = {
  "ac-account":   "Wallet",
  "ac-bridge":    "Bridge",
  "ac-defi":      "DeFi",
  "ac-dex":       "Trading",
  "ac-governance":"Governance",
  "ac-monitor":   "Security",
  "ac-nft":       "NFT",
  "ac-oracle":    "Analytics",
  "ac-push":      "Communication",
  "ac-social":    "Social",
  "ac-storage":   "Storage",
  "ac-yield":     "DeFi",
  "ac-lending":   "DeFi",
  "ac-swap":      "Trading",
  "ac-token":     "Trading",
  "clawhub":      "DevTools",
};

function inferCategory(skill) {
  if (skill.category) return skill.category;
  const slug = skill.slug || "";
  if (SEED_CATEGORIES[slug]) return SEED_CATEGORIES[slug];
  for (const [prefix, cat] of Object.entries(SLUG_PREFIX_CATEGORIES)) {
    if (slug.startsWith(prefix)) return cat;
  }
  const desc = (skill.description || "").toLowerCase();
  if (desc.includes("security") || desc.includes("guard") || desc.includes("audit")) return "Security";
  if (desc.includes("bridge") || desc.includes("relay")) return "Bridge";
  if (desc.includes("nft") || desc.includes("mint")) return "NFT";
  if (desc.includes("swap") || desc.includes("trade") || desc.includes("dex")) return "Trading";
  if (desc.includes("wallet") || desc.includes("account")) return "Wallet";
  if (desc.includes("chat") || desc.includes("message") || desc.includes("notify")) return "Communication";
  if (desc.includes("automat") || desc.includes("schedule") || desc.includes("loop")) return "Automation";
  if (desc.includes("analyt") || desc.includes("monitor") || desc.includes("track")) return "Analytics";
  if (desc.includes("storage") || desc.includes("backup")) return "Storage";
  if (desc.includes("govern") || desc.includes("vote") || desc.includes("dao")) return "Governance";
  if (desc.includes("social") || desc.includes("tweet")) return "Social";
  if (desc.includes("productivity") || desc.includes("workflow")) return "Productivity";
  if (desc.includes("defi") || desc.includes("yield") || desc.includes("lend")) return "DeFi";
  if (desc.includes("writing") || desc.includes("humaniz")) return "Writing";
  return "DevTools";
}

/* ══════════════════════════════════════════════════════════
   Load installed skills (seed + user only — NOT the catalog)
   The full 10K+ catalog is for the browser drawer, not the robot.
   ══════════════════════════════════════════════════════════ */
async function loadInstalledSkills() {
  const [seedRes, userRes, starterRes] = await Promise.all([
    fetchJSON("/api/skills/search?source=seed&limit=500", {}, { retries: 1 }),
    fetchJSON("/api/skillcards/user", {}, { retries: 1 }),
    fetchJSON("/api/pod/starter-pack", {}, { retries: 1, timeoutMs: 12000 }),
  ]);

  const seedSkills = seedRes?.results || [];
  const userSkills = (userRes?.skills || []).map(s => ({ ...s, source: "user" }));
  const starterSkills = (starterRes?.skills || []).map(s => ({ ...s, source: "starter-pack" }));

  const seen = new Set();
  const merged = [];
  for (const s of [...seedSkills, ...starterSkills, ...userSkills]) {
    if (s.slug && !seen.has(s.slug)) {
      seen.add(s.slug);
      merged.push(s);
    }
  }

  // Fallback: if live endpoints briefly fail, populate from stats.recent so the bot still has visible parts.
  if (merged.length === 0) {
    const stats = await fetchJSON("/api/skills/stats", {}, { retries: 1 });
    const recent = Array.isArray(stats?.recent) ? stats.recent : [];
    for (const s of recent) {
      if (s?.slug && !seen.has(s.slug)) {
        seen.add(s.slug);
        merged.push({ ...s, source: s.source || "fallback-recent" });
      }
    }
  }

  skills = merged.map(s => ({ ...s, category: inferCategory(s) }));
  return skills;
}

async function loadAllData() {
  const [_, statusRes, filesRes, botsRes] = await Promise.all([
    loadInstalledSkills(),
    fetchJSON("/api/pod/status"),
    fetchJSON("/api/pod/files", { headers: authHeaders() }),
    fetchJSON("/api/clawbots"),
  ]);

  podStatus = statusRes;
  if (filesRes?.files) podFiles = filesRes.files;
  if (botsRes && Array.isArray(botsRes.clawbots)) clawbots = botsRes.clawbots;

  parseIdentity();
  return skills;
}

function parseIdentity() {
  const identity = podFiles["IDENTITY.md"] || "";
  const soul = podFiles["SOUL.md"] || "";
  const nameMatch = identity.match(/^#\s+(.+)/m);
  if (nameMatch) agentName = nameMatch[1].trim();
  const roleMatch = identity.match(/role:\s*(.+)/i) || identity.match(/^##\s+(.+)/m);
  if (roleMatch) agentRole = roleMatch[1].trim();
  const soulMatch = soul.match(/^#\s+(.+)/m);
  if (soulMatch) agentSoul = soulMatch[1].trim();
}

/* ══════════════════════════════════════════════════════════
   Update HUD elements
   ══════════════════════════════════════════════════════════ */
function updateHeader() {
  const nameEl = document.getElementById("forgeAgentName");
  if (nameEl) nameEl.textContent = agentName;

  const statusEl = document.getElementById("forgeStatus");
  if (statusEl) {
    const dot = statusEl.querySelector(".forge-status-dot");
    const txt = statusEl.querySelector(".forge-status-text");
    const running = podStatus && podStatus.running;
    if (dot) dot.className = `forge-status-dot ${running ? "running" : "stopped"}`;
    if (txt) txt.textContent = running ? "ONLINE" : "OFFLINE";
  }
}

function updateProgress(current, total) {
  const lbl = document.getElementById("forgeSkillCount");
  const fill = document.getElementById("forgeProgressFill");
  if (lbl) lbl.textContent = `${current} / ${total}`;
  if (fill) fill.style.width = `${total > 0 ? (current / total) * 100 : 0}%`;
}

/* ══════════════════════════════════════════════════════════
   Inspector panel
   ══════════════════════════════════════════════════════════ */
function showInspector(ud) {
  document.getElementById("forgeInspectorEmpty").style.display = "none";
  const content = document.getElementById("forgeInspectorContent");
  content.style.display = "flex";
  content.style.animation = "none";
  void content.offsetHeight;
  content.style.animation = "";

  const catColor = CATEGORY_COLORS[ud.category] || "#888";
  document.getElementById("forgeInsCatDot").style.background = catColor;
  document.getElementById("forgeInsName").textContent = ud.skillName || ud.skillSlug;
  document.getElementById("forgeInsBadge").textContent = ud.category || "";
  document.getElementById("forgeInsSlug").textContent = ud.skillSlug || "";
  document.getElementById("forgeInsDesc").textContent = ud.description || "";

  const catTag = document.getElementById("forgeInsCat");
  catTag.textContent = ud.category;
  catTag.style.color = catColor;
  catTag.style.borderColor = catColor + "55";

  const onchainTag = document.getElementById("forgeInsOnchain");
  if (ud.onchain) {
    onchainTag.textContent = "Onchain";
    onchainTag.className = "forge-inspector-tag onchain";
    onchainTag.style.display = "";
  } else {
    onchainTag.style.display = "none";
  }

  const vettedTag = document.getElementById("forgeInsVetted");
  if (ud.vettedOk) {
    vettedTag.textContent = "Vetted";
    vettedTag.className = "forge-inspector-tag vetted";
    vettedTag.style.display = "";
  } else {
    vettedTag.style.display = "none";
  }

  const tierBar = document.getElementById("forgeInsTier");
  const riskColor = ud.risk_tier === "high" || ud.risk_tier >= 3 ? "#ff3333"
    : ud.risk_tier === "medium" || ud.risk_tier === 2 ? "#FFB347" : "#00ff64";
  tierBar.style.setProperty("--tier-color", riskColor);

  const docsEl = document.getElementById("forgeInsDocs");
  if (ud.documentation_md) {
    docsEl.innerHTML = renderSimpleMd(ud.documentation_md);
    docsEl.style.display = "";
  } else {
    docsEl.style.display = "none";
  }

  const uninstallBtn = document.getElementById("forgeInsUninstall");
  if (uninstallBtn) {
    if (ud.source === "user" && ud.fileName) {
      uninstallBtn.style.display = "";
      uninstallBtn.disabled = false;
      uninstallBtn.onclick = () => uninstallSkill(ud.fileName, ud.skillName || ud.skillSlug);
    } else {
      uninstallBtn.style.display = "none";
    }
  }
}

function hideInspector() {
  document.getElementById("forgeInspectorEmpty").style.display = "flex";
  document.getElementById("forgeInspectorContent").style.display = "none";
}

function renderSimpleMd(md) {
  return md
    .replace(/### (.+)/g, "<h3>$1</h3>")
    .replace(/## (.+)/g, "<h2>$1</h2>")
    .replace(/# (.+)/g, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/^- (.+)/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>")
    .replace(/\n{2,}/g, "<br><br>")
    .replace(/\n/g, "<br>");
}

/* ══════════════════════════════════════════════════════════
   Identity plate (CSS2D above robot head)
   ══════════════════════════════════════════════════════════ */
let identityLabel = null;
function buildIdentityPlate() {
  const el = document.createElement("div");
  el.className = "forge-identity-plate";

  const nameDiv = document.createElement("div");
  nameDiv.className = "forge-identity-name";
  nameDiv.textContent = agentName;
  el.appendChild(nameDiv);

  if (agentRole) {
    const roleDiv = document.createElement("div");
    roleDiv.className = "forge-identity-role";
    roleDiv.textContent = agentRole;
    el.appendChild(roleDiv);
  }

  if (agentSoul) {
    const soulDiv = document.createElement("div");
    soulDiv.className = "forge-identity-soul";
    soulDiv.textContent = agentSoul;
    el.appendChild(soulDiv);
  }

  const statusDiv = document.createElement("div");
  statusDiv.className = "forge-identity-status";
  const dot = document.createElement("span");
  const running = podStatus && podStatus.running;
  dot.className = `forge-identity-dot ${running ? "running" : podStatus ? "stopped" : "uninitialized"}`;
  statusDiv.appendChild(dot);
  const txt = document.createElement("span");
  txt.textContent = running ? "ONLINE" : "OFFLINE";
  txt.style.color = "var(--dim)";
  txt.style.fontFamily = "var(--font-mono)";
  txt.style.fontSize = "9px";
  statusDiv.appendChild(txt);
  el.appendChild(statusDiv);

  const label = new CSS2DObject(el);
  label.position.set(0, 8.5, 0);
  return label;
}

/* ══════════════════════════════════════════════════════════
   Install skill
   ══════════════════════════════════════════════════════════ */
async function installSkill(skill) {
  saveAuth();
  const headers = authHeaders();
  if (!headers["x-agent-id"]) {
    toast("Enter Agent ID and Token to install skills", "error");
    return;
  }

  toast(`Installing ${skill.name || skill.slug}...`, "info", 2000);

  try {
    let skillcard = skill;
    if (!skill.version) {
      const detail = await fetchJSON(`/api/skills/get?slug=${encodeURIComponent(skill.slug)}`);
      if (detail?.card) skillcard = detail.card;
    }

    const res = await fetch("/api/skillcards/user/add", {
      method: "POST",
      headers,
      body: JSON.stringify({ skillcard, sourceUrl: skill.sourceUrl || "" }),
    });
    const data = await res.json();

    if (data.ok) {
      const autoCount = Array.isArray(data.autoInstalled) ? data.autoInstalled.length : 0;
      const ocCount = Array.isArray(data.openclawInstalled) ? data.openclawInstalled.length : 0;
      const parts = [`Installed: ${skill.name || skill.slug}`];
      if (autoCount > 0) parts.push(`+${autoCount} dependency`);
      if (ocCount > 0) parts.push(`OpenClaw synced (${ocCount})`);
      toast(parts.join(" · "), "success");
      if (Array.isArray(data.openclawInstallMissing) && data.openclawInstallMissing.length) {
        toast(`OpenClaw sync warning: ${data.openclawInstallMissing[0].reason || "some skills not synced"}`, "error", 4500);
      }
      await rebuildRobot();
      renderSearchResults();
    } else {
      toast(`Install failed: ${data.error || "unknown error"}`, "error");
    }
  } catch (err) {
    toast(`Install error: ${err.message}`, "error");
  }
}

/* ══════════════════════════════════════════════════════════
   Uninstall skill
   ══════════════════════════════════════════════════════════ */
async function uninstallSkill(fileName, displayName) {
  saveAuth();
  const headers = authHeaders();
  if (!headers["x-agent-id"]) {
    toast("Enter Agent ID and Token to uninstall skills", "error");
    return;
  }

  if (!confirm(`Uninstall "${displayName}"? This will remove the skill from your agent.`)) return;

  toast(`Uninstalling ${displayName}...`, "info", 2000);

  try {
    const res = await fetch("/api/skillcards/user/delete", {
      method: "POST",
      headers,
      body: JSON.stringify({ fileName }),
    });
    const data = await res.json();

    if (data.ok) {
      const removed = Array.isArray(data.openclawRemoved) ? data.openclawRemoved.length : 0;
      const msg = removed > 0
        ? `Uninstalled: ${displayName} · OpenClaw removed`
        : `Uninstalled: ${displayName}`;
      toast(msg, "success");
      if (Array.isArray(data.openclawRemoveMissing) && data.openclawRemoveMissing.length) {
        toast(`OpenClaw cleanup warning: ${data.openclawRemoveMissing[0].reason || "cleanup incomplete"}`, "error", 4500);
      }
      selectAttachment(null);
      hideInspector();
      await rebuildRobot();
      renderSearchResults();
    } else {
      toast(`Uninstall failed: ${data.error || "unknown error"}`, "error");
    }
  } catch (err) {
    toast(`Uninstall error: ${err.message}`, "error");
  }
}

/* ══════════════════════════════════════════════════════════
   Rebuild robot (after install/uninstall)
   ══════════════════════════════════════════════════════════ */
async function rebuildRobot() {
  await loadInstalledSkills();
  updateProgress(skills.length, skills.length);

  clearAttachments(attachmentGroup, energyNetworkGroup);

  currentAttachments = buildAttachmentsFromSkills(skills, attachmentGroup);
  buildEnergyNetwork(currentAttachments, energyNetworkGroup);

  const idleAnim = makeIdleAnimator(currentAttachments);
  setIdleAnimator(idleAnim);
}

/* ══════════════════════════════════════════════════════════
   Share to X
   ══════════════════════════════════════════════════════════ */
function initShareToX() {
  const btn = document.getElementById("forgeShareBtn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const byCategory = {};
    let onchainCount = 0;
    skills.forEach(s => {
      byCategory[s.category] = (byCategory[s.category] || 0) + 1;
      if (s.onchain || s.onchainTokenId) onchainCount++;
    });

    const comp = captureScreenshot(agentName, skills.length, onchainCount, Object.keys(byCategory).length);
    comp.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `clawbot-forge-${(agentName || "bot").replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);

      const text = [
        `My @ClutchMarkets agent just assembled ${skills.length} skills in ClawBot Forge`,
        "",
        `${Object.keys(byCategory).length} categories \u00b7 ${onchainCount} minted onchain`,
        "",
        "Build yours: npx ape-claw skill install --starter-pack",
        "",
        "#ApeClaw #OpenClaw #ApeChain",
      ].join("\n");
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank", "width=600,height=400");
    }, "image/png");
  });
}

/* ══════════════════════════════════════════════════════════
   Skill Browser Drawer
   ══════════════════════════════════════════════════════════ */
function initSkillBrowser() {
  const btn = document.getElementById("forgeSkillsBtn");
  const drawer = document.getElementById("forgeDrawer");
  const backdrop = document.getElementById("forgeDrawerBackdrop");
  const closeBtn = document.getElementById("forgeDrawerClose");
  const searchInput = document.getElementById("forgeSkillSearch");

  if (!btn || !drawer) return;

  function openDrawer() {
    drawer.setAttribute("data-open", "1");
    backdrop.setAttribute("data-open", "1");
    searchInput?.focus();
  }
  function closeDrawer() {
    drawer.setAttribute("data-open", "0");
    backdrop.setAttribute("data-open", "0");
  }

  btn.addEventListener("click", openDrawer);
  closeBtn?.addEventListener("click", closeDrawer);
  backdrop?.addEventListener("click", closeDrawer);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && drawer.getAttribute("data-open") === "1") closeDrawer();
  });

  let searchTimer = null;
  searchInput?.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { searchPage = 1; searchSkills(); }, 300);
  });

  document.getElementById("forgeFilterVetted")?.addEventListener("change", () => { searchPage = 1; searchSkills(); });
  document.getElementById("forgeFilterOnchain")?.addEventListener("change", () => { searchPage = 1; searchSkills(); });
  document.getElementById("forgeFilterRisk")?.addEventListener("change", () => { searchPage = 1; searchSkills(); });
  document.getElementById("forgeFilterSource")?.addEventListener("change", () => { searchPage = 1; searchSkills(); });
}

async function searchSkills() {
  const q = document.getElementById("forgeSkillSearch")?.value?.trim() || "";
  const vetted = document.getElementById("forgeFilterVetted")?.checked ? "1" : "";
  const risk = document.getElementById("forgeFilterRisk")?.value || "";
  const sourceMode = document.getElementById("forgeFilterSource")?.value || "alexandria";

  let url = `/api/skills/search?limit=${SEARCH_LIMIT}&page=${searchPage}`;
  if (q) url += `&q=${encodeURIComponent(q)}`;
  if (vetted) url += `&vetted=1`;

  const container = document.getElementById("forgeDrawerResults");
  if (container) container.innerHTML = '<div class="forge-drawer-empty">Searching...</div>';

  const data = await fetchJSON(url);
  if (!data?.results) {
    if (container) container.innerHTML = '<div class="forge-drawer-empty">No results found</div>';
    return;
  }

  allLibrarySkills = data.results;
  searchTotal = data.total || 0;

  let filtered = allLibrarySkills;
  if (sourceMode === "alexandria") {
    filtered = filtered.filter(s => ["imported", "bundled"].includes(String(s.source || "")));
  } else if (sourceMode === "installed") {
    filtered = filtered.filter(s => isInstalled(s.slug));
  }
  if (risk) filtered = filtered.filter(s => String(s.riskTier) === risk);

  renderSearchResults(filtered);
  renderPagination(data.page || 1, data.pages || 1);
}

function isInstalled(slug) {
  return skills.some(s => s.slug === slug);
}

function renderSearchResults(results) {
  const list = results || allLibrarySkills;
  const container = document.getElementById("forgeDrawerResults");
  if (!container) return;

  if (!list.length) {
    container.innerHTML = '<div class="forge-drawer-empty">No skills found</div>';
    return;
  }

  container.innerHTML = list.map(s => {
    const installed = isInstalled(s.slug);
    const catColor = CATEGORY_COLORS[s.category] || "#888";
    const badges = [
      installed ? '<span class="forge-skill-card-badge installed">INSTALLED</span>' : '',
      s.vettedOk ? '<span class="forge-skill-card-badge vetted">V</span>' : '',
      s.onchainTokenId ? '<span class="forge-skill-card-badge onchain">&#x26D3;</span>' : '',
    ].join("");

    const actionBtn = installed
      ? (s.source === "user" && s.fileName
        ? `<button class="forge-btn forge-btn-danger" data-uninstall="${s.fileName}" data-name="${s.name || s.slug}">Uninstall</button>`
        : `<span class="forge-skill-card-badge installed" style="font-size:.58rem">Installed</span>`)
      : `<button class="forge-btn forge-btn-accent" data-install-slug="${s.slug}">Install</button>`;

    return `<div class="forge-skill-card" data-slug="${s.slug}">
      <div class="forge-skill-card-header">
        <span class="forge-skill-card-dot" style="background:${catColor}"></span>
        <span class="forge-skill-card-name">${s.name || s.slug}</span>
        <span class="forge-skill-card-badges">${badges}</span>
      </div>
      <div class="forge-skill-card-desc">${s.description || ""}</div>
      <div class="forge-skill-card-footer">
        <span class="forge-skill-card-cat" style="color:${catColor}">${s.category || "—"}</span>
        <span class="forge-skill-card-actions">${actionBtn}</span>
      </div>
    </div>`;
  }).join("");

  container.querySelectorAll("[data-install-slug]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const slug = btn.getAttribute("data-install-slug");
      const skill = allLibrarySkills.find(s => s.slug === slug);
      if (skill) installSkill(skill);
    });
  });

  container.querySelectorAll("[data-uninstall]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const fileName = btn.getAttribute("data-uninstall");
      const name = btn.getAttribute("data-name");
      uninstallSkill(fileName, name);
    });
  });
}

function renderPagination(currentPage, totalPages) {
  const container = document.getElementById("forgeDrawerPagination");
  if (!container) return;
  if (totalPages <= 1) {
    container.innerHTML = `<span class="forge-page-info">${searchTotal} skills</span>`;
    return;
  }
  container.innerHTML = `
    <button class="forge-page-btn" id="forgePgPrev" ${currentPage <= 1 ? "disabled" : ""}>&larr; Prev</button>
    <span class="forge-page-info">${currentPage} / ${totalPages} &middot; ${searchTotal} skills</span>
    <button class="forge-page-btn" id="forgePgNext" ${currentPage >= totalPages ? "disabled" : ""}>Next &rarr;</button>
  `;
  document.getElementById("forgePgPrev")?.addEventListener("click", () => { searchPage = Math.max(1, searchPage - 1); searchSkills(); });
  document.getElementById("forgePgNext")?.addEventListener("click", () => { searchPage++; searchSkills(); });
}

/* ══════════════════════════════════════════════════════════
   Milestones
   ══════════════════════════════════════════════════════════ */
const MILESTONES = [1, 10, 25, 50, 61, 100, 250, 500, 1000];

function checkMilestone(count) {
  if (!MILESTONES.includes(count)) return;
  import("./forge-scene.js").then(({ tweenValue, composer }) => {
    if (!composer?.passes) return;
    const bloom = composer.passes.find(p => p.strength !== undefined);
    if (bloom) {
      const base = bloom.strength;
      tweenValue(base, base + 1.5, 300, t => t, v => { bloom.strength = v; }, () => {
        tweenValue(bloom.strength, base, 500, t => t, v => { bloom.strength = v; });
      });
    }
  });
}

/* ══════════════════════════════════════════════════════════
   Assembly animation
   ══════════════════════════════════════════════════════════ */
function easeOutBack(t) {
  const c1 = 1.70158; const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function animateAssembly(attachments, onComplete) {
  const STAGGER_MS = Math.max(20, Math.min(60, 3000 / (attachments.length || 1)));
  let completed = 0;
  const total = attachments.length;
  if (total === 0) { onComplete(); return; }

  attachments.forEach((att, i) => {
    const target = att.position.clone();
    att.position.set(
      target.x + (Math.random() - 0.5) * 20,
      target.y + 15,
      target.z + (Math.random() - 0.5) * 20,
    );
    att.visible = false;

    setTimeout(() => {
      att.visible = true;
      updateProgress(i + 1, total);

      const startPos = att.position.clone();
      const startTime = performance.now();
      const duration = 400;

      function tick() {
        const elapsed = performance.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        const e = easeOutBack(t);
        att.position.lerpVectors(startPos, target, e);
        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          completed++;
          checkMilestone(completed);
          if (completed === total) onComplete();
        }
      }
      requestAnimationFrame(tick);
    }, 500 + i * STAGGER_MS);
  });
}

/* ══════════════════════════════════════════════════════════
   Main orchestrator
   ══════════════════════════════════════════════════════════ */
async function init() {
  await new Promise(resolve => {
    if (document.readyState !== "loading") return resolve();
    document.addEventListener("DOMContentLoaded", resolve);
  });

  loadAuth();

  document.getElementById("forgeAuthAgentId")?.addEventListener("change", saveAuth);
  document.getElementById("forgeAuthAgentToken")?.addEventListener("change", saveAuth);

  window.addEventListener("forge:ready", async () => {
    const loaded = await loadAllData();
    updateHeader();
    initShareToX();
    initSkillBrowser();

    if (!loaded || loaded.length === 0) {
      updateProgress(0, 0);
      const statusTxt = document.getElementById("forgeStatus")?.querySelector(".forge-status-text");
      if (statusTxt) statusTxt.textContent = "No skills installed";
      toast("No skills installed. Click the skill browser to add some!", "info", 5000);
      return;
    }

    currentAttachments = buildAttachmentsFromSkills(skills, attachmentGroup);
    buildEnergyNetwork(currentAttachments, energyNetworkGroup);

    if (robotGroup) {
      identityLabel = buildIdentityPlate();
      robotGroup.add(identityLabel);
    }

    animateAssembly(currentAttachments, () => {
      updateProgress(skills.length, skills.length);
      const idleAnim = makeIdleAnimator(currentAttachments);
      setIdleAnimator(idleAnim);

      const chatInput = document.getElementById("forgeChatInput");
      const chatSend = document.getElementById("forgeChatSendBtn");
      if (chatInput) chatInput.disabled = false;
      if (chatSend) chatSend.disabled = false;

      if (skills.length > 0) {
        toast(`${skills.length} skills assembled across ${Object.keys(groupByCategory(skills)).length} categories`, "success", 4000);
      }
    });

    window.addEventListener("forge:select", (e) => showInspector(e.detail));
    window.addEventListener("forge:deselect", () => hideInspector());
  });
}

function groupByCategory(arr) {
  const out = {};
  arr.forEach(s => { out[s.category] = (out[s.category] || 0) + 1; });
  return out;
}

init();
