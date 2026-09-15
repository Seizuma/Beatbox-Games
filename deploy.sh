#!/bin/bash

# Script de déploiement BeatBox Games - Multi-environnements
# Version: 9.0 - 3 environnements (dev, preprod, prod) + CI/CD ready
# Usage: ./deploy.sh [dev|preprod|production] [options]

set -e  # Arrêter le script en cas d'erreur

# ✅ COULEURS pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
ORANGE='\033[0;33m'
NC='\033[0m' # No Color

# ✅ FONCTIONS utilitaires de logging
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_dev() {
    echo -e "${PURPLE}🔧 $1${NC}"
}

log_preprod() {
    echo -e "${ORANGE}🧪 $1${NC}"
}

log_production() {
    echo -e "${CYAN}🎵 $1${NC}"
}

# ✅ Variables globales
BASE_PROJECT_NAME="beatbox-games"
ENVIRONMENT=""
COMPOSE_FILE=""
PROJECT_NAME=""
BRANCH=""
FORCE_CLEANUP=false
NO_BUILD=false
FRESH_BUILD=false
SKIP_CONFIRMATION=false
CI_MODE=false

# Détecter si on est en CI/CD
if [ -n "$CI" ] || [ -n "$GITHUB_ACTIONS" ]; then
    CI_MODE=true
    SKIP_CONFIRMATION=true
    log_info "🤖 Mode CI/CD détecté"
fi

# ✅ Fonction d'aide
show_help() {
    echo "🎵 BeatBox Games - Script de déploiement multi-environnements"
    echo ""
    echo "Usage: ./deploy.sh [ENVIRONMENT] [OPTIONS]"
    echo ""
    echo "ENVIRONMENTS:"
    echo "  dev         - Déployer sur dev.beatboxgames.com (développement)"
    echo "  preprod     - Déployer sur preprod.beatboxgames.com (pre-production)"
    echo "  production  - Déployer sur beatboxgames.com (production)"
    echo "  status      - Voir le statut des containers"
    echo "  logs        - Voir les logs"
    echo "  stop        - Arrêter les containers"
    echo "  cleanup     - Nettoyer Docker"
    echo ""
    echo "OPTIONS:"
    echo "  --no-build      - Ne pas rebuild les images"
    echo "  --fresh         - Rebuild complet sans cache Docker"
    echo "  --force         - Forcer le nettoyage même avec espace suffisant"
    echo "  --yes           - Pas de confirmation (auto pour CI/CD)"
    echo "  --follow        - Suivre les logs (avec logs)"
    echo ""
    echo "EXAMPLES:"
    echo "  ./deploy.sh dev                        # Déploiement dev"
    echo "  ./deploy.sh preprod --yes              # Déploiement preprod sans confirmation"
    echo "  ./deploy.sh production --yes           # Déploiement production"
    echo "  ./deploy.sh status                     # Statut des environnements"
    echo ""
    echo "URLs:"
    echo "  🔧 Dev:        https://dev.beatboxgames.com"
    echo "  🧪 Preprod:    https://preprod.beatboxgames.com"
    echo "  🎵 Production: https://beatboxgames.com"
    echo ""
    echo "ARCHITECTURE:"
    echo "  master → dev / preprod / production"
    echo "  (branches develop et preprod supprimees)"
}
}

# ✅ ANALYSE DE L'ESPACE DISQUE
get_free_space_gb() {
    df / | awk 'NR==2 {print int($4/1024/1024)}'
}

get_docker_usage() {
    sudo docker system df 2>/dev/null || echo "Docker non disponible"
}

analyze_disk_space() {
    log_info "📊 Analyse de l'espace disque disponible..."
    
    INITIAL_FREE_SPACE=$(get_free_space_gb)
    log_info "💾 Espace disque libre: ${INITIAL_FREE_SPACE}GB"
    
    CRITICAL_THRESHOLD=3
    WARNING_THRESHOLD=8
    
    if [ "$INITIAL_FREE_SPACE" -lt "$CRITICAL_THRESHOLD" ]; then
        log_error "🚨 CRITIQUE: Moins de ${CRITICAL_THRESHOLD}GB libre!"
        FORCE_CLEANUP=true
    elif [ "$INITIAL_FREE_SPACE" -lt "$WARNING_THRESHOLD" ]; then
        log_warning "⚠️ ATTENTION: Moins de ${WARNING_THRESHOLD}GB libre"
        FORCE_CLEANUP=true
    else
        log_success "✅ Espace disque suffisant (${INITIAL_FREE_SPACE}GB)"
        FORCE_CLEANUP=false
    fi
    
    echo ""
    log_info "📈 Usage Docker actuel:"
    get_docker_usage
}

# ✅ NETTOYAGE DOCKER INTELLIGENT
perform_docker_cleanup() {
    local cleanup_level=$1
    log_info "🧹 Démarrage du nettoyage Docker (niveau: $cleanup_level)..."
    
    case $cleanup_level in
        "emergency")
            log_error "🚨 NETTOYAGE D'URGENCE"
            sudo docker stop $(sudo docker ps -q --filter "label!=essential") 2>/dev/null || true
            sudo docker system prune -a --volumes --force
            sudo docker builder prune --all --force 2>/dev/null || true
            ;;
        "aggressive")
            log_warning "💪 NETTOYAGE AGRESSIF"
            sudo docker container prune --force
            sudo docker image prune -a --force
            sudo docker volume prune --force
            sudo docker network prune --force
            sudo docker builder prune --force 2>/dev/null || true
            ;;
        "standard")
            log_info "🔧 NETTOYAGE STANDARD"
            sudo docker system prune --force
            sudo docker image prune --force
            ;;
    esac
    
    NEW_FREE_SPACE=$(get_free_space_gb)
    RECOVERED_SPACE=$((NEW_FREE_SPACE - INITIAL_FREE_SPACE))
    
    if [ "$RECOVERED_SPACE" -gt 0 ]; then
        log_success "✅ Espace récupéré: ${RECOVERED_SPACE}GB"
    fi
    log_info "💾 Espace libre maintenant: ${NEW_FREE_SPACE}GB"
}

# ✅ VÉRIFICATION NGINX-PROXY-MANAGER
check_nginx_proxy() {
    log_info "👀 Vérification nginx-proxy-manager..."
    if sudo docker ps --filter "name=nginx-proxy-manager" --format "{{.Names}}" | grep -q "nginx-proxy-manager" 2>/dev/null; then
        NPM_STATUS=$(sudo docker ps --filter "name=nginx-proxy-manager" --format "{{.Status}}" 2>/dev/null)
        log_success "nginx-proxy-manager: $NPM_STATUS"
    else
        log_warning "nginx-proxy-manager non détecté"
    fi
}

# ✅ CONFIGURATION ENVIRONNEMENT
setup_environment() {
    local env=$1
    
    case $env in
        "dev")
            ENVIRONMENT="dev"
            COMPOSE_FILE="docker-compose.dev.yml"
            PROJECT_NAME="beatbox-games-dev"
            BRANCH="master"
            log_dev "=== CONFIGURATION DEV ==="
            log_dev "🔧 Environnement: dev.beatboxgames.com"
            log_dev "🏷️ Projet Docker: $PROJECT_NAME"
            log_dev "🔀 Branche Git: $BRANCH"
            log_dev "📝 Logs: DEBUG"
            ;;
        "preprod")
            ENVIRONMENT="preprod"
            COMPOSE_FILE="docker-compose.preprod.yml"
            PROJECT_NAME="beatbox-games-preprod"
            BRANCH="master"
            log_preprod "=== CONFIGURATION PREPROD ==="
            log_preprod "🧪 Environnement: preprod.beatboxgames.com"
            log_preprod "🏷️ Projet Docker: $PROJECT_NAME"
            log_preprod "🔀 Branche Git: $BRANCH"
            log_preprod "📝 Logs: INFO"
            ;;
        "production")
            ENVIRONMENT="production"
            COMPOSE_FILE="docker-compose.yml"
            PROJECT_NAME="beatbox-games-prod"
            BRANCH="master"
            log_production "=== CONFIGURATION PRODUCTION ==="
            log_production "🎵 Environnement: beatboxgames.com"
            log_production "🏷️ Projet Docker: $PROJECT_NAME"
            log_production "🔀 Branche Git: $BRANCH"
            log_production "📝 Logs: INFO"
            ;;
        *)
            log_error "Environnement invalide: $env"
            exit 1
            ;;
    esac
}

# ✅ FONCTION PRINCIPALE: Déploiement
deploy_environment() {
    local env=$1
    setup_environment $env
    
    echo ""
    log_info "🚀 Démarrage du déploiement $ENVIRONMENT..."
    echo ""
    
    # Confirmation pour production et preprod
    if [ "$ENVIRONMENT" = "production" ] && [ "$SKIP_CONFIRMATION" != true ]; then
        log_production "⚠️  ATTENTION: Déploiement en PRODUCTION"
        read -p "Êtes-vous sûr? (yes/no): " confirm
        if [ "$confirm" != "yes" ]; then
            log_error "Déploiement annulé"
            exit 0
        fi
    fi
    
    if [ "$ENVIRONMENT" = "preprod" ] && [ "$SKIP_CONFIRMATION" != true ] && [ "$CI_MODE" != true ]; then
        log_preprod "⚠️  Déploiement en PREPROD"
        read -p "Continuer? (yes/no): " confirm
        if [ "$confirm" != "yes" ]; then
            log_error "Déploiement annulé"
            exit 0
        fi
    fi
    
    # Vérifier que le fichier compose existe
    if [ ! -f "$COMPOSE_FILE" ]; then
        log_error "Fichier $COMPOSE_FILE introuvable"
        exit 1
    fi
    
    # Analyse espace disque
    analyze_disk_space
    
    # Nettoyage si nécessaire
    if [ "$FORCE_CLEANUP" = true ]; then
        perform_docker_cleanup "aggressive"
    fi
    
    # ✅ GIT: Checkout et Pull de la bonne branche
    log_info "🔀 Mise à jour du code depuis GitHub..."
    log_info "Branch cible: $BRANCH"
    
    # Vérifier qu'on est sur la bonne branche
    CURRENT_BRANCH=$(git branch --show-current)
    if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
        log_warning "Switching from $CURRENT_BRANCH to $BRANCH"
        if ! git checkout $BRANCH; then
            log_error "Échec du checkout vers $BRANCH"
            exit 1
        fi
    fi
    
    # Pull depuis la branche
    if git pull origin $BRANCH; then
        log_success "Code mis à jour depuis $BRANCH"
        
        # Afficher les derniers commits
        log_info "📝 Derniers commits:"
        git log -3 --oneline --decorate
    else
        log_error "Échec du pull depuis $BRANCH"
        exit 1
    fi
    
    # Vérifier nginx-proxy-manager
    check_nginx_proxy
    
    # Arrêter les anciens conteneurs
    log_info "🛑 Arrêt des anciens conteneurs $ENVIRONMENT..."
    sudo docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" down 2>/dev/null || true
    
    # Build et démarrage
    if [ "$NO_BUILD" = false ]; then
        if [ "$FRESH_BUILD" = true ]; then
            log_info "🏗️  Construction des images Docker (sans cache)..."
            sudo docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" build --no-cache
        else
            log_info "🏗️  Construction des images Docker (cache actif)..."
            sudo docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" build
        fi
    fi
    
    log_info "▶️  Démarrage des services..."
    sudo docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" up -d
    
    # Attendre que le healthcheck passe (max 90s) au lieu d'un sleep fixe
    log_info "⏳ Attente du healthcheck..."
    HEALTH_OK=false
    for i in $(seq 1 30); do
        if sudo docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" ps --format '{{.Health}}' 2>/dev/null | grep -q "healthy"; then
            HEALTH_OK=true
            log_success "Services healthy après ${i}x3s"
            break
        fi
        sleep 3
    done
    
    if [ "$HEALTH_OK" = false ]; then
        log_warning "Healthcheck non validé après 90s — vérifier les logs"
    fi
    
    # Vérifier le statut
    log_info "📊 Statut des conteneurs:"
    sudo docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" ps
    
    # Test de santé
    case $ENVIRONMENT in
        "production")
            if curl -s -f https://beatboxgames.com/health > /dev/null 2>&1; then
                log_success "✅ Production en ligne"
            else
                log_warning "⚠️ Production démarrée mais endpoint non accessible"
            fi
            ;;
        "preprod")
            if curl -s -f https://preprod.beatboxgames.com/health > /dev/null 2>&1; then
                log_success "✅ Preprod en ligne"
            else
                log_warning "⚠️ Preprod démarrée mais endpoint non accessible"
            fi
            ;;
        "dev")
            if curl -s -f https://dev.beatboxgames.com/health > /dev/null 2>&1; then
                log_success "✅ Dev en ligne"
            else
                log_warning "⚠️ Dev démarrée mais endpoint non accessible"
            fi
            ;;
    esac
    
    echo ""
    log_success "🎯 Déploiement $ENVIRONMENT terminé avec succès!"
}

# ✅ FONCTION: Statut des services
show_status() {
    echo "📊 Statut des environnements BeatBox Games"
    echo ""
    
    # Production
    log_production "🎵 Production (beatboxgames.com)"
    if [ -f "docker-compose.yml" ] && sudo docker compose -p "beatbox-games-prod" ps 2>/dev/null | grep -q "Up"; then
        sudo docker compose -p "beatbox-games-prod" ps
        if curl -s -f https://beatboxgames.com/health > /dev/null 2>&1; then
            log_success "✅ Accessible"
        fi
    else
        log_info "❌ Aucun container"
    fi
    
    echo ""
    # Preprod
    log_preprod "🧪 Preprod (preprod.beatboxgames.com)"
    if [ -f "docker-compose.preprod.yml" ] && sudo docker compose -p "beatbox-games-preprod" -f docker-compose.preprod.yml ps 2>/dev/null | grep -q "Up"; then
        sudo docker compose -p "beatbox-games-preprod" -f docker-compose.preprod.yml ps
        if curl -s -f https://preprod.beatboxgames.com/health > /dev/null 2>&1; then
            log_success "✅ Accessible"
        fi
    else
        log_info "❌ Aucun container"
    fi
    
    echo ""
    # Dev
    log_dev "🔧 Dev (dev.beatboxgames.com)"
    if [ -f "docker-compose.dev.yml" ] && sudo docker compose -p "beatbox-games-dev" -f docker-compose.dev.yml ps 2>/dev/null | grep -q "Up"; then
        sudo docker compose -p "beatbox-games-dev" -f docker-compose.dev.yml ps
        if curl -s -f https://dev.beatboxgames.com/health > /dev/null 2>&1; then
            log_success "✅ Accessible"
        fi
    else
        log_info "❌ Aucun container"
    fi
    
    echo ""
    log_info "💾 Utilisation système:"
    get_docker_usage
    
    echo ""
    check_nginx_proxy
}

# ✅ FONCTION: Logs interactifs
show_logs() {
    echo "Logs disponibles:"
    echo "1. 🎵 Production"
    echo "2. 🧪 Preprod"
    echo "3. 🔧 Dev"
    echo "4. 📊 Nginx Proxy Manager"
    read -p "Choisissez [1-4]: " choice
    
    case $choice in
        1)
            if [ -f "docker-compose.yml" ]; then
                log_production "Logs Production:"
                if [ "$FOLLOW_LOGS" = "true" ]; then
                    sudo docker compose -p "beatbox-games-prod" logs -f
                else
                    sudo docker compose -p "beatbox-games-prod" logs --tail=50
                fi
            fi
            ;;
        2)
            if [ -f "docker-compose.preprod.yml" ]; then
                log_preprod "Logs Preprod:"
                if [ "$FOLLOW_LOGS" = "true" ]; then
                    sudo docker compose -p "beatbox-games-preprod" -f docker-compose.preprod.yml logs -f
                else
                    sudo docker compose -p "beatbox-games-preprod" -f docker-compose.preprod.yml logs --tail=50
                fi
            fi
            ;;
        3)
            if [ -f "docker-compose.dev.yml" ]; then
                log_dev "Logs Dev:"
                if [ "$FOLLOW_LOGS" = "true" ]; then
                    sudo docker compose -p "beatbox-games-dev" -f docker-compose.dev.yml logs -f
                else
                    sudo docker compose -p "beatbox-games-dev" -f docker-compose.dev.yml logs --tail=50
                fi
            fi
            ;;
        4)
            log_info "Logs Nginx Proxy Manager:"
            sudo docker ps --filter "name=nginx-proxy-manager" -q | head -1 | xargs -r sudo docker logs --tail=50 2>/dev/null || log_error "Non trouvé"
            ;;
    esac
}

# ✅ FONCTION: Arrêt sélectif
stop_services() {
    echo "Que voulez-vous arrêter?"
    echo "1. 🎵 Production"
    echo "2. 🧪 Preprod"
    echo "3. 🔧 Dev"
    echo "4. 🔄 Tous"
    read -p "Choisissez [1-4]: " choice
    
    case $choice in
        1)
            sudo docker compose -p "beatbox-games-prod" down
            log_success "✅ Production arrêtée"
            ;;
        2)
            sudo docker compose -p "beatbox-games-preprod" -f docker-compose.preprod.yml down
            log_success "✅ Preprod arrêtée"
            ;;
        3)
            sudo docker compose -p "beatbox-games-dev" -f docker-compose.dev.yml down
            log_success "✅ Dev arrêtée"
            ;;
        4)
            sudo docker compose -p "beatbox-games-prod" down 2>/dev/null || true
            sudo docker compose -p "beatbox-games-preprod" -f docker-compose.preprod.yml down 2>/dev/null || true
            sudo docker compose -p "beatbox-games-dev" -f docker-compose.dev.yml down 2>/dev/null || true
            log_success "✅ Tous arrêtés"
            ;;
    esac
}

# ✅ PARSING des arguments
COMMAND=""
FOLLOW_LOGS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        dev|preprod|production)
            COMMAND="$1"
            shift
            ;;
        status|logs|stop|cleanup)
            COMMAND="$1"
            shift
            ;;
        --no-build)
            NO_BUILD=true
            shift
            ;;
        --fresh)
            FRESH_BUILD=true
            shift
            ;;
        --force)
            FORCE_CLEANUP=true
            shift
            ;;
        --yes)
            SKIP_CONFIRMATION=true
            shift
            ;;
        --follow)
            FOLLOW_LOGS=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            log_error "Option inconnue: $1"
            show_help
            exit 1
            ;;
    esac
done

# ✅ MAIN
echo "🎵 BeatBox Games - Déploiement multi-environnements v9.0"
echo "Project: $BASE_PROJECT_NAME"
if [ "$CI_MODE" = true ]; then
    echo "Mode: CI/CD 🤖"
fi
echo ""

if [ -z "$COMMAND" ]; then
    show_help
    exit 1
fi

# Vérifications
log_info "🔍 Vérification des prérequis..."
if ! command -v docker &> /dev/null; then
    log_error "Docker non installé"
    exit 1
fi

if ! command -v git &> /dev/null; then
    log_error "Git non installé"
    exit 1
fi

log_success "Prérequis OK"

# Exécution
case $COMMAND in
    dev|preprod|production)
        deploy_environment $COMMAND
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    stop)
        stop_services
        ;;
    cleanup)
        analyze_disk_space
        if [ "$FORCE_CLEANUP" = true ]; then
            perform_docker_cleanup "aggressive"
        else
            perform_docker_cleanup "standard"
        fi
        ;;
    *)
        log_error "Commande inconnue: $COMMAND"
        show_help
        exit 1
        ;;
esac

echo ""
log_success "🎯 Opération terminée avec succès!"