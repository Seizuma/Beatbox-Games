# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Arguments de build
ARG NODE_ENV=production
ARG REACT_APP_ENV=production
ARG REACT_APP_API_URL=https://beatboxgames.com
ARG GENERATE_SOURCEMAP=false

# Définir les variables d'environnement
ENV NODE_ENV=$NODE_ENV
ENV REACT_APP_ENV=$REACT_APP_ENV
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV GENERATE_SOURCEMAP=$GENERATE_SOURCEMAP

# Copier seulement package.json et package-lock.json d'abord
COPY package*.json ./

# Utiliser npm install au lieu de npm ci pour résoudre les conflits
RUN npm install

# Copier le code source
COPY . .

# Afficher les variables pour debug
RUN echo "Building with REACT_APP_API_URL=$REACT_APP_API_URL" && \
    echo "Building with REACT_APP_ENV=$REACT_APP_ENV"

# Build l'application
RUN npm run build

# Production stage
FROM nginx:stable-alpine

# Copier seulement le build depuis l'étape précédente
COPY --from=builder /app/build /usr/share/nginx/html

# Ajouter un header pour identifier l'environnement
RUN echo 'add_header X-Environment "production" always;' >> /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]