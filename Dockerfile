# syntax=docker/dockerfile:1
# Imagem multi-arquitetura (amd64 e arm64 — compatível com OCI Ampere A1)
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

# CLI do Prisma com todas as dependências, só para aplicar migrations na inicialização
FROM node:22-alpine AS migrator
WORKDIR /opt/prisma
RUN apk add --no-cache openssl && npm init -y >/dev/null && npm install --omit=dev --no-audit --no-fund prisma@6.19.3

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl && addgroup -S app && adduser -S app -G app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/prisma ./prisma
COPY --from=migrator /opt/prisma /opt/prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/node_modules/bcryptjs ./node_modules/bcryptjs
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/bcryptjs ./node_modules/bcryptjs
USER app
EXPOSE 3000
# Aplica migrations pendentes e sobe o servidor
CMD ["sh", "-c", "node /opt/prisma/node_modules/prisma/build/index.js migrate deploy && node prisma/seed.mjs && node server.js"]
