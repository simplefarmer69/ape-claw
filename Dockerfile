FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY ui ./ui
COPY config ./config
COPY allowlists ./allowlists
COPY install.sh ./install.sh
COPY README.md ./README.md

# Shared state directory can be mounted to persistent storage.
ENV APE_CLAW_UI_PORT=8787
ENV APE_CLAW_ROOT=/app
ENV APE_CLAW_STATE_DIR=/data/state

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.APE_CLAW_UI_PORT || 8787) + '/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "./src/telemetry-server.mjs"]
