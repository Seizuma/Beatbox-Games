# ---------- Étape 1 : dépendances de production ----------
# Image complète : contient les outils de compilation si better-sqlite3 doit être compilé
FROM node:20-bookworm AS deps
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
    && node -e "require('better-sqlite3')(':memory:'); console.log('SQLite OK')"

# ---------- Étape 2 : image d'exécution ----------
# Même base Debian (bookworm) en version slim : compatible avec le module natif compilé à l'étape 1
FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Dossiers montés par docker compose (données SQLite, photos des beatboxers, fichiers publics)
RUN mkdir -p /app/data /app/beatbox_artists /app/public

EXPOSE 4000

# curl et wget ne sont pas présents dans l'image slim : le contrôle de santé passe par Node
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://localhost:4000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]