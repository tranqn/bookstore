# ── Build stage ──────────────────────────────────────────────
FROM node:22-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Prune to production dependencies for the runtime image (the server bundle
# externalizes @huggingface/transformers, onnxruntime-node and sharp, so they
# must be present in node_modules at runtime).
RUN npm prune --omit=dev

# ── Runtime stage ────────────────────────────────────────────
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production

# EmbeddingGemma downloads once into this cache on first start; mount a
# volume here to persist it across container recreations.
ENV HF_HOME=/app/.cache/huggingface

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist/bookstore ./dist/bookstore

RUN mkdir -p /app/.cache/huggingface && chown -R node:node /app/.cache
USER node

EXPOSE 4000
# PORT, GEMINI_API_KEY, NG_ALLOWED_HOSTS, DISABLE_SEMANTIC via -e / compose.

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||4000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/bookstore/server/server.mjs"]
