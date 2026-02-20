FROM node:22-alpine

RUN adduser --disabled-password --gecos "" apeclaw

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY ui ./ui
COPY config ./config
COPY allowlists ./allowlists
COPY skillcards ./skillcards
COPY data ./data
COPY scripts ./scripts

COPY <<'ENTRYPOINT' /app/entrypoint.sh
#!/bin/sh
set -e
STATE="${APE_CLAW_STATE_DIR:-/data/state}"
mkdir -p "$STATE" /data/config /data/allowlists

# Seed persistent config files into /data/ on first run
[ -f /data/config/policy.json ] || cp /app/config/policy.example.json /data/config/policy.json
[ -f /data/config/clawbots.json ] || cp /app/config/clawbots.example.json /data/config/clawbots.json
[ -f /data/allowlists/recommended.apechain.json ] || cp /app/allowlists/recommended.apechain.json /data/allowlists/recommended.apechain.json
[ -f /data/allowlists/opensea-slug-overrides.json ] || cp /app/allowlists/opensea-slug-overrides.json /data/allowlists/opensea-slug-overrides.json

# Symlink persistent config from /data/ into /app/ so the server
# (with APE_CLAW_ROOT=/app) finds them and writes are persisted.
for f in config/policy.json config/clawbots.json allowlists/recommended.apechain.json allowlists/opensea-slug-overrides.json; do
  if [ -f "/data/$f" ]; then
    ln -sf "/data/$f" "/app/$f"
  fi
done

if [ ! -f "$STATE/events.jsonl" ] && [ -f /app/data/events-backlog.json ]; then
  echo "[seed] Seeding events.jsonl from backlog..."
  node -e "
    const fs = require('fs');
    const backlog = JSON.parse(fs.readFileSync('/app/data/events-backlog.json','utf8'));
    const events = backlog.events || [];
    const lines = events.map(e => JSON.stringify(e)).join('\n');
    fs.writeFileSync('$STATE/events.jsonl', lines + '\n');
    console.log('[seed] Wrote', events.length, 'events');
  "
fi

[ -f "$STATE/chat.jsonl" ] || touch "$STATE/chat.jsonl"

echo "[init] root=/app state=$STATE"
if [ -f /app/scripts/bootstrap-openclaw.sh ]; then
  echo "[init] running openclaw bootstrap..."
  /bin/sh /app/scripts/bootstrap-openclaw.sh || echo "[warn] bootstrap-openclaw failed; continuing startup"
fi

exec node /app/src/server/index.mjs
ENTRYPOINT

RUN chmod +x /app/entrypoint.sh /app/scripts/bootstrap-openclaw.sh && chown -R apeclaw:apeclaw /app

ENV APE_CLAW_UI_PORT=8787
ENV APE_CLAW_ROOT=/app
ENV APE_CLAW_STATE_DIR=/data/state

EXPOSE 8787

USER apeclaw

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.APE_CLAW_UI_PORT || 8787) + '/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["/app/entrypoint.sh"]
