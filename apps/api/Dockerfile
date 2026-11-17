# syntax=docker/dockerfile:1
# Image de l'API, qui sert aussi l'export web de l'app. Contexte de build : racine du monorepo.

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

FROM base AS web-build
RUN npm ci -w @subtracker/mobile -w @subtracker/contracts -w @subtracker/detection --ignore-scripts
COPY packages ./packages
COPY apps/mobile ./apps/mobile
# Render transmet les variables d'environnement du service comme arguments de build :
# la carte de démonstration de l'app suit ainsi l'activation des données de démo côté API.
ARG ENABLE_DEMO_DATA=false
# URL relative : le bundle appelle l'API qui le sert, sur la même origine.
ENV CI=1 EXPO_NO_TELEMETRY=1 EXPO_PUBLIC_API_URL=/api EXPO_PUBLIC_ENABLE_DEMO=${ENABLE_DEMO_DATA}
RUN cd apps/mobile && npx expo export --platform web

FROM base AS prod-deps
RUN npm ci -w @subtracker/api --omit=dev --ignore-scripts && npm rebuild argon2

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production WEB_DIST_DIR=/app/web
WORKDIR /app
COPY --from=prod-deps /repo/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=web-build /repo/apps/mobile/dist ./web
COPY apps/api/package.json ./package.json
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
