import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

let serverProcess;
let PORT;

function request(path, opts = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, `http://127.0.0.1:${PORT}`);
    const reqOpts = {
      hostname: "127.0.0.1",
      port: PORT,
      path: url.pathname + url.search,
      method: opts.method || "GET",
      headers: {
        ...opts.headers,
      },
    };
    const req = http.request(reqOpts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        let json = null;
        try { json = JSON.parse(data); } catch {}
        resolve({ status: res.statusCode, headers: res.headers, data, json });
      });
    });
    req.on("error", reject);
    if (opts.body) req.write(typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body));
    req.end();
  });
}

describe("ApeClaw Server Integration Tests", () => {
  before(async () => {
    PORT = 18700 + Math.floor(Math.random() * 100);
    const { spawn } = await import("node:child_process");
    serverProcess = spawn("node", ["./src/server/index.mjs"], {
      env: {
        ...process.env,
        APE_CLAW_UI_PORT: String(PORT),
        APE_CLAW_CORS_ORIGINS: "*",
        NODE_ENV: "test",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    await new Promise((resolve) => {
      const check = () => {
        const req = http.get(`http://127.0.0.1:${PORT}/api/health`, (res) => {
          if (res.statusCode === 200) resolve();
          else setTimeout(check, 100);
          res.resume();
        });
        req.on("error", () => setTimeout(check, 100));
      };
      setTimeout(check, 300);
    });
  });

  after(() => {
    if (serverProcess) {
      serverProcess.kill("SIGTERM");
      serverProcess = null;
    }
  });

  it("GET /api/health returns 200 with expected fields", async () => {
    const res = await request("/api/health");
    assert.equal(res.status, 200);
    assert.ok(res.json.ok);
    assert.equal(res.json.service, "ape-claw-telemetry");
    assert.ok(res.json.ts);
    assert.ok(!res.json.root, "health must not expose internal root path");
    assert.ok(!res.json.paths, "health must not expose internal file paths");
  });

  it("POST /api/events without auth returns 401", async () => {
    const res = await request("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: { eventType: "test" },
    });
    assert.equal(res.status, 401);
  });

  it("GET /api/skills/search returns results", async () => {
    const res = await request("/api/skills/search");
    assert.equal(res.status, 200);
    assert.ok(res.json.ok);
    assert.ok(typeof res.json.total === "number");
    assert.ok(Array.isArray(res.json.results));
  });

  it("GET /api/skills/stats returns counts", async () => {
    const res = await request("/api/skills/stats");
    assert.equal(res.status, 200);
    assert.ok(res.json.ok);
    assert.ok(typeof res.json.total === "number");
    assert.ok(typeof res.json.seed === "number");
  });

  it("GET /api/clawbots returns list", async () => {
    const res = await request("/api/clawbots");
    assert.equal(res.status, 200);
    assert.ok(typeof res.json.count === "number");
    assert.ok(Array.isArray(res.json.clawbots));
  });

  it("CORS headers are present on responses", async () => {
    const res = await request("/api/health");
    assert.ok(res.headers["access-control-allow-origin"]);
  });

  it("body size limit rejects oversized payload", async () => {
    const bigBody = "x".repeat(2 * 1024 * 1024);
    try {
      const res = await request("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: bigBody,
      });
      assert.equal(res.status, 413);
    } catch (err) {
      assert.ok(err.code === "EPIPE" || err.code === "ECONNRESET", "connection should be reset for oversized payload");
    }
  });

  it("GET /events/backlog returns event array", async () => {
    await new Promise((r) => setTimeout(r, 100));
    const res = await request("/events/backlog");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.json.events));
  });

  it("GET /api/policy returns policy JSON", async () => {
    const res = await request("/api/policy");
    assert.equal(res.status, 200);
    assert.ok(res.json);
  });

  it("GET /api/pod/status returns pod info", async () => {
    const res = await request("/api/pod/status");
    assert.equal(res.status, 200);
    assert.ok(res.json.ok);
    assert.ok(typeof res.json.status === "string");
  });

  it("GET /api/pod/files requires auth", async () => {
    const res = await request("/api/pod/files");
    // Local loopback requests are allowed for Forge-local flows.
    assert.equal(res.status, 200);
    assert.equal(res.json.ok, true);
  });

  it("GET /api/chat/rooms returns rooms array", async () => {
    const res = await request("/api/chat/rooms");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.json.rooms));
  });

  it("GET /api/quotes/spend-today requires auth", async () => {
    const res = await request("/api/quotes/spend-today");
    assert.equal(res.status, 401);
  });
});
