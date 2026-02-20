const MAX_BODY_BYTES = 1024 * 1024; // 1 MB

/**
 * Collects the full request body up to MAX_BODY_BYTES.
 * Returns the raw string, or null if the body exceeds the limit
 * (in which case a 413 response is sent automatically).
 */
export function collectBody(req, res, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        req.destroy();
        if (!res.headersSent) {
          res.writeHead(413, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "request body too large" }));
        }
        resolve(null);
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });

    req.on("error", (err) => {
      reject(err);
    });
  });
}
