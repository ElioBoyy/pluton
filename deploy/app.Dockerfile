# pluton-app (app.plut0n.com): the API server and the worker in one container, the web app's build
# served by the server. Replaces Coolify's railpack build, whose npm (bundled with Node) and pnpm
# shipped vulnerable copies of undici and brace-expansion.
#
# Build from the repo root: docker build -f deploy/app.Dockerfile .

FROM node:24-trixie-slim

# Debian security updates; CA certificates, time zones and curl (Coolify's health check runs it in
# the container), as railpack's image had them.
RUN apt-get update \
 && apt-get upgrade -y \
 && apt-get install -y --no-install-recommends ca-certificates curl tzdata \
 && rm -rf /var/lib/apt/lists/*

# npm 11.21.2 replaces the one shipped with Node (undici 6.29.1, brace-expansion 5.0.12), pnpm 12.20.0
# matches package.json's packageManager (undici 7.30.2). Yarn and corepack, unused, go first (removing
# corepack after pnpm drops pnpm's links). pnpm's install script links its native binary: npm 11.21
# only runs it when allowed.
RUN npm uninstall -g corepack \
 && rm -rf /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg \
 && npm install -g npm@11.21.2 \
 && npm install -g --allow-scripts=pnpm pnpm@12.20.0 \
 && npm -v && pnpm -v \
 && npm cache clean --force \
 && rm -rf /root/.npm /tmp/*

WORKDIR /app
COPY . .

# Dev dependencies stay: tsx runs the server and the worker, and the server builds the LinkedIn
# extension with esbuild the first time it is downloaded. NODE_ENV is set after, for the runtime only.
# The store is deleted in the same layer: node_modules keeps its files.
RUN pnpm install --frozen-lockfile --store-dir /tmp/pnpm-store \
 && pnpm --filter @pluton/web build \
 && rm -rf /tmp/* /root/.cache /root/.local/share/pnpm /root/.npm

# The rest of the environment (PLUTON_HOSTED, DATABASE_URL, the keys) comes from Coolify.
ENV NODE_ENV=production \
    SERVER_HOST=0.0.0.0 \
    SERVER_PORT=8787

# /app/data holds secret.key, logos, wallpapers and models: Coolify mounts a volume there.
EXPOSE 8787

# Either process dying stops the container, so Coolify restarts both.
CMD ["bash", "-c", "pnpm --filter @pluton/worker start & pnpm --filter @pluton/server start & wait -n; exit 1"]
