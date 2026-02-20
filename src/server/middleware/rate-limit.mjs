const buckets = new Map();

function clientKey(req, prefix) {
  const xff = String(req.headers["x-forwarded-for"] || "").trim();
  const ip = xff ? xff.split(",")[0].trim() : String(req.socket?.remoteAddress || "unknown");
  return `${prefix}:${ip}`;
}

/**
 * Returns true (and sends 429) if the request exceeds the rate limit.
 * Returns false if the request is within limits.
 */
export function checkRateLimit(req, res, { limit = 60, windowMs = 60_000, keyPrefix = "default" } = {}) {
  const key = clientKey(req, keyPrefix);
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart > windowMs) {
    bucket = { windowStart: now, count: 0 };
    buckets.set(key, bucket);
  }

  bucket.count++;

  if (bucket.count > limit) {
    const retryAfter = Math.ceil((bucket.windowStart + windowMs - now) / 1000);
    res.writeHead(429, {
      "content-type": "application/json",
      "retry-after": String(retryAfter),
    });
    res.end(JSON.stringify({ error: "rate limit exceeded", retryAfterSeconds: retryAfter }));
    return true;
  }

  return false;
}

// Purge stale buckets every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - 300_000;
  for (const [key, bucket] of buckets) {
    if (bucket.windowStart < cutoff) buckets.delete(key);
  }
}, 300_000).unref();
