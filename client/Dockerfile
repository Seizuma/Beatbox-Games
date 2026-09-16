# ---------- Étape 1 : build React ----------
FROM node:20-alpine AS builder
WORKDIR /app

ARG NODE_ENV=production
ARG REACT_APP_ENV=production
ARG REACT_APP_API_URL=https://beatboxgames.com
ARG GENERATE_SOURCEMAP=false

ENV NODE_ENV=$NODE_ENV \
    REACT_APP_ENV=$REACT_APP_ENV \
    REACT_APP_API_URL=$REACT_APP_API_URL \
    GENERATE_SOURCEMAP=$GENERATE_SOURCEMAP

COPY package*.json ./
# npm install tant que package-lock.json n'est pas resynchronisé avec package.json (voir notes)
RUN npm install --no-audit --no-fund

COPY . .
RUN echo "Build $REACT_APP_ENV avec REACT_APP_API_URL=$REACT_APP_API_URL" && npm run build

# ---------- Étape 2 : fichiers statiques servis par Nginx ----------
FROM nginx:stable-alpine

ARG REACT_APP_ENV=production

COPY --from=builder /app/build /usr/share/nginx/html

# En-tête pour identifier l'environnement (production, preprod, development)
RUN echo "add_header X-Environment \"$REACT_APP_ENV\" always;" >> /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]