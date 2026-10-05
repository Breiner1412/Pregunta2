# syntax=docker/dockerfile:1

# ---- 1. Dependencias ----
FROM node:22-alpine AS deps
# Recomendado por Next.js para binarios nativos sobre musl (Alpine).
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- 2. Build ----
FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- 3. Imagen final ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

# Corre sin privilegios de root.
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

# standalone trae server.js y solo los node_modules necesarios; public y
# .next/static se copian aparte para que server.js los sirva.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
