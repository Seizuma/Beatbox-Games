#!/bin/bash

# Script d'installation automatique - Beatbox Games v9.0
# À exécuter sur votre VPS après avoir copié les fichiers

set -e

echo "🎵 Installation Beatbox Games v9.0"
echo "===================================="
echo ""

# Vérifier qu'on est dans le bon dossier
if [ ! -f "package.json" ]; then
    echo "❌ Erreur : package.json introuvable"
    echo "Assurez-vous d'être dans le dossier Beatbox-Games"
    exit 1
fi

echo "✅ Dossier correct détecté"
echo ""

# 1. Backup des anciens fichiers
echo "📦 Backup des anciens fichiers..."
BACKUP_DIR="backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

[ -f "deploy.sh" ] && cp deploy.sh "$BACKUP_DIR/"
[ -f "docker-compose.yml" ] && cp docker-compose.yml "$BACKUP_DIR/"
[ -f "docker-compose.staging.yml" ] && cp docker-compose.staging.yml "$BACKUP_DIR/"
[ -f ".env.staging" ] && cp .env.staging "$BACKUP_DIR/"
[ -f ".env.production" ] && cp .env.production "$BACKUP_DIR/"

echo "✅ Backup créé dans $BACKUP_DIR/"
echo ""

# 2. Arrêter les anciens containers
echo "🛑 Arrêt des anciens containers..."
sudo docker compose -p "blindtestbeatbox-prod" down 2>/dev/null || true
sudo docker compose -p "blindtestbeatbox-staging" -f docker-compose.staging.yml down 2>/dev/null || true
sudo docker compose -p "blindtestbeatbox" down 2>/dev/null || true
sudo docker compose -p "blindtestbeatbox" -f docker-compose.staging.yml down 2>/dev/null || true
echo "✅ Anciens containers arrêtés"
echo ""

# 3. Créer les volumes
echo "💾 Création des volumes Docker..."
sudo docker volume create beatbox-data-prod 2>/dev/null || echo "Volume beatbox-data-prod existe déjà"
sudo docker volume create beatbox-data-preprod 2>/dev/null || echo "Volume beatbox-data-preprod existe déjà"
sudo docker volume create beatbox-data-dev 2>/dev/null || echo "Volume beatbox-data-dev existe déjà"
echo "✅ Volumes créés"
echo ""

# 4. Vérifier les nouveaux fichiers
echo "🔍 Vérification des fichiers nécessaires..."
MISSING_FILES=0

if [ ! -f "deploy.sh" ]; then
    echo "❌ deploy.sh manquant"
    MISSING_FILES=1
fi

if [ ! -f "docker-compose.yml" ]; then
    echo "❌ docker-compose.yml manquant"
    MISSING_FILES=1
fi

if [ ! -f "docker-compose.preprod.yml" ]; then
    echo "❌ docker-compose.preprod.yml manquant"
    MISSING_FILES=1
fi

if [ ! -f "docker-compose.dev.yml" ]; then
    echo "❌ docker-compose.dev.yml manquant"
    MISSING_FILES=1
fi

if [ $MISSING_FILES -eq 1 ]; then
    echo ""
    echo "⚠️  Fichiers manquants détectés"
    echo "Assurez-vous d'avoir copié tous les fichiers avant d'exécuter ce script"
    exit 1
fi

echo "✅ Tous les fichiers sont présents"
echo ""

# 5. Rendre deploy.sh exécutable
echo "🔧 Configuration de deploy.sh..."
chmod +x deploy.sh
echo "✅ deploy.sh est maintenant exécutable"
echo ""

# 6. Créer/Adapter les fichiers .env
echo "📝 Configuration des fichiers .env..."

# .env.dev
if [ ! -f ".env.dev" ]; then
    if [ -f ".env.staging" ]; then
        echo "Création de .env.dev depuis .env.staging..."
        cp .env.staging .env.dev
    elif [ -f ".env.production" ]; then
        echo "Création de .env.dev depuis .env.production..."
        cp .env.production .env.dev
    else
        echo "⚠️  Aucun .env source trouvé pour créer .env.dev"
        echo "Vous devrez le créer manuellement"
    fi
fi

# .env.preprod
if [ ! -f ".env.preprod" ]; then
    if [ -f ".env.production" ]; then
        echo "Création de .env.preprod depuis .env.production..."
        cp .env.production .env.preprod
    else
        echo "⚠️  .env.production introuvable, impossible de créer .env.preprod"
        echo "Vous devrez le créer manuellement"
    fi
fi

echo ""
echo "⚠️  IMPORTANT : Vous devez éditer manuellement les fichiers .env"
echo ""
echo "Éditez .env.dev et changez :"
echo "  NODE_ENV=development"
echo "  BASE_URL=https://dev.beatboxgames.com"
echo "  CLIENT_URL=https://dev.beatboxgames.com"
echo ""
echo "Éditez .env.preprod et changez :"
echo "  NODE_ENV=preprod"
echo "  BASE_URL=https://preprod.beatboxgames.com"
echo "  CLIENT_URL=https://preprod.beatboxgames.com"
echo ""

# 7. Vérifier les branches Git
echo "🔀 Vérification des branches Git..."
git fetch origin 2>/dev/null || true
git branch -a

if ! git show-ref --verify --quiet refs/heads/preprod; then
    echo "⚠️  Branche preprod introuvable localement"
    if git show-ref --verify --quiet refs/remotes/origin/preprod; then
        echo "Checkout de preprod depuis origin..."
        git checkout preprod
        git checkout main
    else
        echo "❌ Branche preprod n'existe pas sur origin"
        echo "Créez-la depuis GitHub ou manuellement"
    fi
fi

echo ""

# 8. Résumé
echo "============================================"
echo "✅ Installation terminée !"
echo "============================================"
echo ""
echo "📋 Prochaines étapes :"
echo ""
echo "1. Éditez les fichiers .env :"
echo "   nano .env.dev"
echo "   nano .env.preprod"
echo ""
echo "2. Vérifiez les branches Git :"
echo "   git branch -a"
echo ""
echo "3. Déployez les environnements :"
echo "   git checkout develop && ./deploy.sh dev --yes"
echo "   git checkout preprod && ./deploy.sh preprod --yes"
echo "   git checkout main && ./deploy.sh production --yes"
echo ""
echo "4. Vérifiez le statut :"
echo "   ./deploy.sh status"
echo ""
echo "📦 Backup sauvegardé dans : $BACKUP_DIR/"
echo ""