# ---------- Étape 1 : build React ----------
FROM node:20-alpine AS builder
WORKDIR /app

ARG NODE_ENV=production
ARG REACT_APP_ENV=production
ARG REACT_APP_API_URL=https://beatboxgames.com
ARG GENERATE_SOURCEMAP=false
# Version de test réservée aux comptes autorisés (docker-compose.dev.yml) ; off partout ailleurs
ARG REACT_APP_ACCESS_GATE=false

ENV NODE_ENV=$NODE_ENV \
    REACT_APP_ENV=$REACT_APP_ENV \
    REACT_APP_API_URL=$REACT_APP_API_URL \
    GENERATE_SOURCEMAP=$GENERATE_SOURCEMAP \
    REACT_APP_ACCESS_GATE=$REACT_APP_ACCESS_GATE

COPY package*.json ./
# npm install tant que package-lock.json n'est pas resynchronisé avec package.json (voir notes)
RUN npm install --no-audit --no-fund

COPY . .
RUN echo "Build $REACT_APP_ENV avec REACT_APP_API_URL=$REACT_APP_API_URL" && npm run build

# ---------- Étape 2 : fichiers statiques servis par Nginx ----------
FROM nginx:stable-alpine

ARG REACT_APP_ENV=production

COPY --from=builder /app/build /usr/share/nginx/html

# Configuration nginx : vraies adresses, /invite/ et /sitemap.xml transmis au serveur Node,
# moteurs de recherche bloqués hors production, en-tête X-Environment. Rendue au démarrage
# avec ces variables (docker-compose les précise pour chaque environnement).
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
ENV APP_ENV=$REACT_APP_ENV \
    SERVER_UPSTREAM=beatbox-games-prod-server:4000

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]