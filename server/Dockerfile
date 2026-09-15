# ✅ Utiliser node:20 (Debian) au lieu de node:20-alpine
FROM node:20
WORKDIR /app
# Copier les fichiers de dépendances
COPY package*.json ./
# Installer les dépendances
RUN npm ci --only=production
# Copier le code source
COPY . .
# ✅ AJOUT : Vérifier que beatbox_artists existe et lister son contenu
RUN echo "📂 Vérification du dossier beatbox_artists..." && \
    if [ -d "beatbox_artists" ]; then \
        echo "✅ beatbox_artists trouvé" && \
        ls -la beatbox_artists/ && \
        echo "📊 Nombre d'images: $(find beatbox_artists/ -type f \( -name '*.jpg' -o -name '*.png' \) | wc -l)"; \
    else \
        echo "❌ ERREUR CRITIQUE: beatbox_artists MANQUANT !" && \
        echo "💡 Le dossier doit exister dans ./server/beatbox_artists/" && \
        exit 1; \
    fi
# Créer le dossier data pour SQLite
RUN mkdir -p /app/data && \
    chmod 755 /app/data && \
    echo "✅ Data directory created"
# Vérifier que better-sqlite3 fonctionne
RUN node -e "const db = require('better-sqlite3')(':memory:'); console.log('✅ SQLite test passed');"
EXPOSE 4000
ENV NODE_ENV=production
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1
CMD ["node", "server.js"]