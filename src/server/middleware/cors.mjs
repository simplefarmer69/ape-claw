const ALLOWED_ORIGINS = new Set([
  "https://apeclaw.ai",
  "https://www.apeclaw.ai",
  "http://localhost:8787",
  "http://localhost:3000",
  "http://127.0.0.1:8787",
]);

function originAllowed(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  if (/\.vercel\.app$/.test(origin)) return true;
  return false;
}

export function handleCorsPreflightOrSetHeaders(req, res) {
  const origin = String(req.headers.origin || "").trim();
  const allowed = originAllowed(origin);
  const reflect = allowed && origin ? origin : "*";

  res.setHeader("access-control-allow-origin", reflect);
  res.setHeader("access-control-allow-methods", "GET, POST, PATCH, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type, x-agent-id, x-agent-token, x-registration-key, x-moltbook-identity, x-api-key");
  res.setHeader("access-control-max-age", "86400");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return true;
  }
  return false;
}
