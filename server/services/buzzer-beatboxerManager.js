const fs = require('fs');
const path = require('path');

class BeatboxerManager {
    constructor() {
        this.beatboxersData = [];
        // ✅ Le dossier doit être copié dans /app/beatbox_artists par Docker
        this.dataPath = path.join(process.cwd(), 'beatbox_artists', 'beatboxers.json');
        this.imagesPath = path.join(process.cwd(), 'beatbox_artists');

        console.log('📂 Chemin beatboxers.json:', this.dataPath);
        console.log('📂 Working directory:', process.cwd());

        this.loadData();
    }

    /**
     * Charge les données des beatboxers depuis le JSON
     */
    loadData() {
        try {
            console.log('📂 Tentative de chargement:', this.dataPath);

            if (fs.existsSync(this.dataPath)) {
                const rawData = fs.readFileSync(this.dataPath, 'utf8');
                const allBeatboxers = JSON.parse(rawData);
                this.beatboxersData = allBeatboxers.filter(b => b.local_image && b.local_image.trim() !== '');
                console.log(`✅ ${this.beatboxersData.length}/${allBeatboxers.length} beatboxers chargés (avec image locale)`);

                // ✅ NOUVEAU : Debug - Afficher quelques exemples
                if (this.beatboxersData.length > 0) {
                    console.log('📋 Premier beatboxer:', {
                        title: this.beatboxersData[0].title,
                        nationality: this.beatboxersData[0].nationality,
                        achievements: this.beatboxersData[0].achievements?.length || 0
                    });
                }
            } else {
                console.error('❌ Fichier beatboxers.json introuvable à:', this.dataPath);
                console.log('💡 Vérifiez que le dossier beatbox_artists existe à la racine du projet serveur');
            }
        } catch (error) {
            console.error('❌ Erreur chargement beatboxers:', error);
            console.error('📍 Chemin tenté:', this.dataPath);
        }
    }

    /**
     * Obtient tous les pays uniques
     */
    /**
     * Obtient tous les pays uniques (avec au moins 8 beatboxers)
     */
    getAllCountries() {
        const countryCount = new Map();

        this.beatboxersData.forEach(beatboxer => {
            if (beatboxer.nationality && beatboxer.nationality !== null) {
                const country = beatboxer.nationality;
                countryCount.set(country, (countryCount.get(country) || 0) + 1);
            }
        });

        // Filtrer les pays avec au moins 8 beatboxers
        const validCountries = [];
        countryCount.forEach((count, country) => {
            if (count >= 8) {
                validCountries.push(country);
            }
        });

        const countriesList = validCountries.sort();
        console.log(`🌍 ${countriesList.length} pays trouvés (avec ≥1 beatboxers)`);

        // Afficher quelques stats
        if (countriesList.length > 0) {
            const topCountries = Array.from(countryCount.entries())
                .filter(([country, count]) => count >= 1)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);

            console.log('📊 Top 5 pays:');
            topCountries.forEach(([country, count]) => {
                console.log(`   - ${country}: ${count} beatboxers`);
            });
        }

        return countriesList;
    }

    /**
     * Obtient tous les événements uniques (avec au moins 8 beatboxers)
     */
    getAllEvents() {
        const eventBeatboxers = new Map(); // événement -> Set de beatboxers

        this.beatboxersData.forEach(beatboxer => {
            if (beatboxer.achievements && Array.isArray(beatboxer.achievements)) {
                beatboxer.achievements.forEach(achievement => {
                    if (achievement.event && achievement.event !== null) {
                        const event = achievement.event;

                        // Créer un Set pour cet événement s'il n'existe pas
                        if (!eventBeatboxers.has(event)) {
                            eventBeatboxers.set(event, new Set());
                        }

                        // Ajouter le beatboxer (par son titre unique)
                        eventBeatboxers.get(event).add(beatboxer.title);
                    }
                });
            }
        });

        // Filtrer les événements avec au moins 8 beatboxers
        const validEvents = [];
        eventBeatboxers.forEach((beatboxers, event) => {
            if (beatboxers.size >= 8) {
                validEvents.push(event);
            }
        });

        const eventsList = validEvents.sort();
        console.log(`🏆 ${eventsList.length} événements trouvés (avec ≥8 beatboxers)`);

        // Afficher quelques stats
        if (eventsList.length > 0) {
            const topEvents = Array.from(eventBeatboxers.entries())
                .filter(([event, beatboxers]) => beatboxers.size >= 8)
                .sort((a, b) => b[1].size - a[1].size)
                .slice(0, 5);

            console.log('📊 Top 5 événements:');
            topEvents.forEach(([event, beatboxers]) => {
                console.log(`   - ${event}: ${beatboxers.size} beatboxers`);
            });
        }

        return eventsList;
    }

    /**
     * Filtre les beatboxers par pays
     */
    getBeatboxersByCountry(country) {
        const filtered = this.beatboxersData.filter(b => b.nationality === country);
        console.log(`🔍 ${filtered.length} beatboxers trouvés pour le pays: ${country}`);
        return filtered;
    }

    /**
     * Filtre les beatboxers par événement
     */
    getBeatboxersByEvent(eventName) {
        const filtered = this.beatboxersData.filter(beatboxer => {
            if (!beatboxer.achievements) return false;
            return beatboxer.achievements.some(achievement =>
                achievement.event === eventName
            );
        });
        console.log(`🔍 ${filtered.length} beatboxers trouvés pour l'événement: ${eventName}`);
        return filtered;
    }

    /**
     * Obtient un beatboxer aléatoire selon les filtres
     */
    getRandomBeatboxer(filters = {}) {
        let pool = this.beatboxersData;

        if (filters.country) {
            pool = this.getBeatboxersByCountry(filters.country);
        }

        if (filters.event) {
            pool = this.getBeatboxersByEvent(filters.event);
        }

        if (pool.length === 0) {
            console.warn('⚠️ Aucun beatboxer trouvé avec les filtres:', filters);
            return null;
        }

        const selected = pool[Math.floor(Math.random() * pool.length)];
        console.log('🎲 Beatboxer sélectionné:', selected.title);
        return selected;
    }

    /**
     * Obtient le chemin local de l'image d'un beatboxer
     */
    getBeatboxerImagePath(beatboxer) {
        if (beatboxer.local_image) {
            return path.join(this.imagesPath, beatboxer.local_image);
        }
        return null;
    }

    /**
     * Vérifie si une image locale existe
     */
    hasLocalImage(beatboxer) {
        const imagePath = this.getBeatboxerImagePath(beatboxer);
        return imagePath && fs.existsSync(imagePath);
    }

    /**
     * ✅ Obtient l'URL de l'image pour le client
     */
    getBeatboxerImageUrl(beatboxer) {
        if (beatboxer.local_image) {
            // ✅ Utiliser CONFIG.BASE_URL qui gère tous les environnements
            const { CONFIG } = require('../constants');
            const baseUrl = CONFIG.BASE_URL;
            return `${baseUrl}/api/beatboxer-images/${encodeURIComponent(beatboxer.local_image)}`;
        }
        // Fallback sur l'image externe si disponible
        return beatboxer.image_url || null;
    }
    /**
     * ✅ Obtient les données complètes d'un beatboxer pour le client
     */
    getBeatboxerData(beatboxer) {
        return {
            title: beatboxer.title,
            nationality: beatboxer.nationality,
            imageUrl: this.getBeatboxerImageUrl(beatboxer),
            achievements: beatboxer.achievements || []
        };
    }

    /**
     * Obtient les statistiques
     */
    getStats() {
        const totalBeatboxers = this.beatboxersData.length;
        const withImages = this.beatboxersData.filter(b => this.hasLocalImage(b)).length;
        const countries = this.getAllCountries();
        const events = this.getAllEvents();

        const stats = {
            totalBeatboxers,
            withImages,
            withoutImages: totalBeatboxers - withImages,
            totalCountries: countries.length,
            totalEvents: events.length,
            countries: countries.slice(0, 10), // Premiers 10 pays
            events: events.slice(0, 10) // Premiers 10 événements
        };

        console.log('📊 Statistiques Buzzer Battle:', stats);
        return stats;
    }
}

// Singleton
const beatboxerManager = new BeatboxerManager();

module.exports = beatboxerManager;