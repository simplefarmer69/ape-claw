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

COPY <<'ENTRYPOINT' /app/entrypoint.sh
#!/bin/sh
set -e
STATE="${APE_CLAW_STATE_DIR:-/data/state}"
mkdir -p "$STATE"

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

if [ ! -f "$STATE/chat.jsonl" ]; then
  touch "$STATE/chat.jsonl"
fi

exec node ./src/server/index.mjs
ENTRYPOINT

RUN chmod +x /app/entrypoint.sh && chown -R apeclaw:apeclaw /app

ENV APE_CLAW_UI_PORT=8787
ENV APE_CLAW_ROOT=/app
ENV APE_CLAW_STATE_DIR=/data/state

EXPOSE 8787

USER apeclaw

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.APE_CLAW_UI_PORT || 8787) + '/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["/app/entrypoint.sh"]
