# pluton-site (plut0n.com): the Astro site, built then served by nginx. Replaces Coolify's railpack
# static build, whose Alpine packages (libxslt 1.1.43-r3) were out of date.
#
# Build from the repo root: docker build -f deploy/site.Dockerfile .

FROM node:24-trixie-slim AS build
RUN npm install -g pnpm@12.20.0
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile --filter @pluton/site... \
 && pnpm --filter @pluton/site build

FROM nginx:1.31-alpine
# Alpine security updates (libxslt and the rest) on top of the nginx image.
RUN apk upgrade --no-cache
COPY deploy/site.nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/site/dist/ /usr/share/nginx/html/
EXPOSE 80
