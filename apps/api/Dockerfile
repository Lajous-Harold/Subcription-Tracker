# syntax=docker/dockerfile:1
# Image de l'API. Contexte de build : racine du monorepo (packages partagés inclus).

FROM node:24-bookworm-slim AS base
WORKDIR /repo
# Manifests seuls d'abord : le cache Docker évite de réinstaller si seul le code change.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/mobile/package.json apps/mobile/
COPY packages/contracts/package.json packages/contracts/
COPY packages/detection/package.json packages/detection/

FROM base AS build
RUN npm ci -w @subtracker/api -w @subtracker/contracts -w @subtracker/detection --include-workspace-root --ignore-scripts \
  && npm rebuild argon2
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN npm run build -w @subtracker/api

FROM base AS prod-deps
RUN npm ci -w @subtracker/api --omit=dev --ignore-scripts && npm rebuild argon2

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /repo/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY apps/api/package.json ./package.json
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
