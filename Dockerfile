# Polaris — Render deployment (static frontend + Node API adapter)
FROM node:20-slim

ENV NODE_ENV=production \
    ELECTRON_SKIP_BINARY_DOWNLOAD=1 \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /app

# 1) dependencies (cached layer)
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# 2) source
COPY . .

# 3) frontend build (vite only; tsc typecheck intentionally skipped for build speed)
RUN npx vite build

# 4) adapter runtime dependency
RUN npm i --no-save --no-audit --no-fund express@4

ENV PORT=10000
EXPOSE 10000

CMD ["npx", "tsx", "deploy/server.ts"]
