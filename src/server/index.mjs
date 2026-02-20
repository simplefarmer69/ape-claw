/**
 * ApeClaw telemetry server -- modular entry point.
 *
 * Replaces the monolithic telemetry-server.mjs.
 * All route logic lives in routes/, middleware in middleware/, storage in storage/.
 */

import http from "node:http";
import fs from "node:fs";
import { POLICY_PATH } from "../lib/paths.mjs";
import { initStorage } from "./storage/index.mjs";
import { initSseBroadcast, closeAllClients } from "./sse.mjs";
import { handleCorsPreflightOrSetHeaders } from "./middleware/cors.mjs";
import { checkRateLimit } from "./middleware/rate-limit.mjs";
import logger from "./logger.mjs";

import { handleHealth } from "./routes/health.mjs";
import { handleEventsSse, handleEventsBacklog, handlePostEvent } from "./routes/events.mjs";
import {
  handleSkillsSearch, handleSkillsGet, handleSkillsStats,
  handleSkillcardsUserGet, handleSkillcardsAuthCheck,
  handleSkillcardsUserAdd, handleSkillcardsUserDelete,
  handleSkillcardsUserMarkOnchain, handleSkillcardFile,
} from "./routes/skills.mjs";
import {
  handleClawbotsList, handleClawbotsVerify,
  handleInviteCreate, handleClawbotsRegister,
} from "./routes/clawbots.mjs";
import {
  handleChatStream, handleChatGet, handleChatRooms,
  handleChatPost, handleChatReact,
} from "./routes/chat.mjs";
import { handleForgeChat, initForgeAgent } from "./routes/forge-agent.mjs";
import { handleV2ReceiptGet, handleV2Config } from "./routes/v2.mjs";
import { handlePodStatus, handlePodStop, handlePodFiles, handleStarterPack } from "./routes/pod.mjs";
import {
  handleCreateQuote, handleGetQuote, handlePatchQuote, handleQuotesSpendToday,
  handleCreateBridgeRequest, handleGetBridgeRequest, handlePatchBridgeRequest, handleBridgeSpendToday,
} from "./routes/quotes.mjs";
import {
  handleAllowlist, handlePolicy, handleRewrite,
  handleIndex, handleStaticFile,
} from "./routes/static.mjs";

const PORT = Number(process.env.PORT || process.env.APE_CLAW_UI_PORT || 8787);
const BIND_HOST = String(process.env.APE_CLAW_BIND_HOST || "").trim();

const RL_READ = { limit: 60, windowMs: 60_000, keyPrefix: "read" };
const RL_WRITE = { limit: 10, windowMs: 60_000, keyPrefix: "write" };
const RL_AUTH = { limit: 5, windowMs: 60_000, keyPrefix: "auth" };

// ── Startup validation ──
if (!fs.existsSync(POLICY_PATH)) {
  logger.warn({ path: POLICY_PATH }, "config/policy.json not found — some features may not work");
}
if (!process.env.OPENSEA_API_KEY) {
  logger.info("OPENSEA_API_KEY not set — allowlist icons will be unavailable");
}

initStorage();
initSseBroadcast();
initForgeAgent();
logger.info("Storage initialized, SSE broadcast active, forge agent ready");

function safeHandler(fn) {
  return (req, res, ...args) => {
    try {
      const result = fn(req, res, ...args);
      if (result && typeof result.catch === "function") {
        result.catch((err) => {
          logger.error({ err, url: req.url, method: req.method }, "Unhandled route error");
          if (!res.headersSent) { res.writeHead(500, { "content-type": "application/json" }); }
          if (!res.writableEnded) { res.end(JSON.stringify({ error: "internal server error" })); }
        });
      }
    } catch (err) {
      logger.error({ err, url: req.url, method: req.method }, "Sync route error");
      if (!res.headersSent) { res.writeHead(500, { "content-type": "application/json" }); }
      if (!res.writableEnded) { res.end(JSON.stringify({ error: "internal server error" })); }
    }
  };
}

const server = http.createServer((req, res) => {
  if (!req.url) return res.end("bad request");
  const reqUrl = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = reqUrl.pathname;

  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  if (handleCorsPreflightOrSetHeaders(req, res)) return;

  if (pathname.startsWith("/api/")) {
    const isAuth = pathname.startsWith("/api/clawbots/register") || pathname.startsWith("/api/clawbots/verify");
    const isWrite = req.method === "POST" || req.method === "PATCH";
    const rl = isAuth ? RL_AUTH : isWrite ? RL_WRITE : RL_READ;
    if (checkRateLimit(req, res, rl)) return;
  }

  // ── SSE streams (rate-limited) ──
  if (pathname === "/events" || pathname === "/events/backlog") {
    if (checkRateLimit(req, res, RL_READ)) return;
  }
  if (pathname === "/events") return safeHandler(handleEventsSse)(req, res);
  if (pathname === "/events/backlog") return safeHandler(handleEventsBacklog)(req, res, reqUrl);

  // ── API routes ──
  if (pathname === "/api/health") return safeHandler(handleHealth)(req, res);
  if (pathname === "/api/allowlist") return safeHandler(handleAllowlist)(req, res);
  if (pathname === "/api/policy") return safeHandler(handlePolicy)(req, res);
  if (pathname === "/api/skillcards/user" && req.method === "GET") return safeHandler(handleSkillcardsUserGet)(req, res);
  if (pathname === "/api/skills/search" && req.method === "GET") return safeHandler(handleSkillsSearch)(req, res, reqUrl);
  if (pathname === "/api/skills/get" && req.method === "GET") return safeHandler(handleSkillsGet)(req, res, reqUrl);
  if (pathname === "/api/skills/stats" && req.method === "GET") return safeHandler(handleSkillsStats)(req, res);
  if (pathname === "/api/skillcards/user/auth-check" && req.method === "GET") return safeHandler(handleSkillcardsAuthCheck)(req, res);
  if (pathname === "/api/skillcards/user/add" && req.method === "POST") return safeHandler(handleSkillcardsUserAdd)(req, res);
  if (pathname === "/api/skillcards/user/delete" && req.method === "POST") return safeHandler(handleSkillcardsUserDelete)(req, res);
  if (pathname === "/api/skillcards/user/mark-onchain" && req.method === "POST") return safeHandler(handleSkillcardsUserMarkOnchain)(req, res);
  if (pathname.startsWith("/skillcards/") && req.method === "GET") return safeHandler(handleSkillcardFile)(req, res, pathname);
  if (pathname === "/api/clawbots" && req.method === "GET") return safeHandler(handleClawbotsList)(req, res);
  if (pathname === "/api/clawbots/verify" && req.method === "POST") return safeHandler(handleClawbotsVerify)(req, res);
  if (pathname === "/api/invites/create" && req.method === "POST") return safeHandler(handleInviteCreate)(req, res);
  if (pathname === "/api/clawbots/register" && req.method === "POST") return safeHandler(handleClawbotsRegister)(req, res);
  if (pathname === "/api/events" && req.method === "POST") return safeHandler(handlePostEvent)(req, res);
  if (pathname === "/api/forge/chat" && req.method === "POST") return safeHandler(handleForgeChat)(req, res);
  if (pathname === "/api/chat/stream") return safeHandler(handleChatStream)(req, res, reqUrl);
  if (pathname === "/api/chat" && req.method === "GET") return safeHandler(handleChatGet)(req, res, reqUrl);
  if (pathname === "/api/chat/rooms" && req.method === "GET") return safeHandler(handleChatRooms)(req, res, reqUrl);
  if (pathname === "/api/chat" && req.method === "POST") return safeHandler(handleChatPost)(req, res, reqUrl);
  if (pathname === "/api/chat/react" && req.method === "POST") return safeHandler(handleChatReact)(req, res, reqUrl);
  if (pathname === "/api/v2/receipt/get" && req.method === "GET") return safeHandler(handleV2ReceiptGet)(req, res, reqUrl);
  if (pathname === "/api/v2/config" && req.method === "GET") return safeHandler(handleV2Config)(req, res);
  if (pathname === "/api/pod/status" && req.method === "GET") return safeHandler(handlePodStatus)(req, res);
  if (pathname === "/api/pod/files" && req.method === "GET") return safeHandler(handlePodFiles)(req, res);
  if (pathname === "/api/pod/starter-pack" && req.method === "GET") return safeHandler(handleStarterPack)(req, res);
  if (pathname === "/api/pod/stop" && req.method === "POST") return safeHandler(handlePodStop)(req, res);

  // ── Quote & bridge-request state APIs (M2) ──
  if (pathname === "/api/quotes" && req.method === "POST") return safeHandler(handleCreateQuote)(req, res);
  if (pathname === "/api/quotes/spend-today" && req.method === "GET") return safeHandler(handleQuotesSpendToday)(req, res);
  if (pathname.startsWith("/api/quotes/") && req.method === "GET") return safeHandler(handleGetQuote)(req, res, reqUrl);
  if (pathname.startsWith("/api/quotes/") && req.method === "PATCH") return safeHandler(handlePatchQuote)(req, res, reqUrl);
  if (pathname === "/api/bridge-requests" && req.method === "POST") return safeHandler(handleCreateBridgeRequest)(req, res);
  if (pathname === "/api/bridge-requests/spend-today" && req.method === "GET") return safeHandler(handleBridgeSpendToday)(req, res);
  if (pathname.startsWith("/api/bridge-requests/") && req.method === "GET") return safeHandler(handleGetBridgeRequest)(req, res, reqUrl);
  if (pathname.startsWith("/api/bridge-requests/") && req.method === "PATCH") return safeHandler(handlePatchBridgeRequest)(req, res, reqUrl);

  // ── Static / rewrite ──
  if (handleRewrite(req, res, pathname)) return;
  if (pathname === "/" || pathname === "/index.html") return safeHandler(handleIndex)(req, res);
  if (handleStaticFile(req, res, pathname)) return;

  res.writeHead(404);
  res.end("not found");
});

// ── Graceful shutdown ──
let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutting down...");
  closeAllClients();
  server.close(() => {
    logger.info("Server closed.");
    process.exit(0);
  });
  setTimeout(() => { logger.warn("Forceful shutdown after timeout."); process.exit(1); }, 10_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

server.listen(PORT, BIND_HOST || undefined, () => {
  logger.info({ port: PORT, bind: BIND_HOST || "0.0.0.0", corsOrigins: process.env.APE_CLAW_CORS_ORIGINS || "(default)" }, "Server listening");
  console.log(`ape-claw telemetry server listening on http://localhost:${PORT}`);
  console.log(`SSE stream: http://localhost:${PORT}/events`);
});

export { server };
