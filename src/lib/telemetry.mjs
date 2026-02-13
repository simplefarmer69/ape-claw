import { appendJsonl, nowIso, randomId } from "./io.mjs";
import { EVENTS_PATH } from "./paths.mjs";

export function emitEvent({
  eventType,
  agentId = "local-cli",
  sessionId = "local-session",
  traceId = null,
  command = "",
  dryRun = true,
  chainId = 33139,
  payload = {},
  result = {},
  ok = true,
  error = null,
}) {
  const evt = {
    v: 1,
    ts: nowIso(),
    eventType,
    agentId,
    sessionId,
    traceId: traceId || randomId("trace"),
    command,
    dryRun,
    chainId,
    payload,
    result,
    ok,
    error,
  };
  appendJsonl(EVENTS_PATH, evt);
  return evt;
}

