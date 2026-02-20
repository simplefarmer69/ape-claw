/**
 * Structured logger for the ApeClaw server.
 *
 * Uses pino for JSON output in production and pretty-print in dev.
 * CLI keeps using console (pino would interfere with --json output).
 */

import pino from "pino";

const isDev = String(process.env.NODE_ENV || "").toLowerCase() !== "production";

const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
  ...(isDev ? { transport: { target: "pino/file", options: { destination: 1 } } } : {}),
});

export default logger;

export function childLogger(bindings) {
  return logger.child(bindings);
}
