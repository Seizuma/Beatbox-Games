/**
 * Gestionnaire des fichiers audio
 * ✅ CORRIGÉ : URLs audio et gestion des chemins
 */

const fs = require('fs');
const path = require('path');
const { CONFIG, GAME_MODES } = require('../constants');

class AudioManager {
    constructor() {
        this.audioCache = new Map();
        this.totalArtistsCache = new Map();
        this.initializeCache();
    }

    /**
     * Initialise le cache des fichiers audio
     */
    initializeCache() {
        try {
            // ✅ CORRECTION : Chemins multiples possibles selon l'environnement
            const possiblePaths = [
                path.join(__dirname, '../../public', 'audio'),  // Développement
                path.join(__dirname, '../public', 'audio'),     // Production
                path.join(process.cwd(), 'public', 'audio'),    // Docker
                '/app/public/audio'                              // Docker absolu
            ];

            let audioDir = null;
            let files = [];

            // Tester chaque chemin possible
            for (const testPath of possiblePaths) {
                try {
                    if (fs.existsSync(testPath)) {
                        files = fs.readdirSync(testPath);
                        audioDir = testPath;
                        console.log(`✅ Dossier audio trouvé: ${testPath}`);
                        break;
                    }
                } catch (err) {
                    continue;
                }
            }

            if (!audioDir) {
                console.warn('⚠️ Aucun dossier audio trouvé, utilisation des valeurs par défaut');
                this.setDefaultValues();
                return;
            }

            const level1Files = files.filter(f => f.startsWith('Level 1 -') && f.endsWith('.mp3'));

            if (level1Files.length === 0) {
                console.warn('⚠️ Aucun fichier Level 1 trouvé, utilisation des valeurs par défaut');
                this.setDefaultValues();
                return;
            }

            this.audioCache.set('all_level1_files', level1Files);
            this.audioCache.set('audio_dir', audioDir);
            this.totalArtistsCache.set(GAME_MODES.NORMAL, level1Files.length);
            this.totalArtistsCache.set(GAME_MODES.QUICK, Math.min(10, level1Files.length));

            console.log(`🎵 AudioManager initialisé: ${level1Files.length} morceaux disponibles depuis ${audioDir}`);
        } catch (error) {
            console.error('❌ Erreur initialisation AudioManager:', error);
            this.setDefaultValues();
        }
    }

    /**
     * ✅ NOUVEAU : Définit des valeurs par défaut en cas d'échec
     */
    setDefaultValues() {
        this.audioCache.set('all_level1_files', []);
        this.totalArtistsCache.set(GAME_MODES.NORMAL, 10);
        this.totalArtistsCache.set(GAME_MODES.QUICK, 5);
        console.log('📁 Utilisation des valeurs par défaut pour l\'audio');
    }

    /**
     * Obtient le nombre total d'artistes selon le mode de jeu
     */
    getTotalArtistsCount(gameMode = GAME_MODES.NORMAL) {
        return this.totalArtistsCache.get(gameMode) ||
            (gameMode === GAME_MODES.QUICK ? 5 : 10);
    }

    /**
     * ✅ CORRIGÉ : Génère les URLs audio correctement
     */
    generateAudioUrl(filename) {
        // ✅ CRITIQUE : URL relative depuis le dossier public
        const baseAudioUrl = '/audio';
        return `${baseAudioUrl}/${encodeURIComponent(filename)}`;
    }

    /**
     * Estime la durée d'un fichier audio selon son nom
     */
    getAudioDuration(filename) {
        if (filename.includes('Level 1')) return CONFIG.AUDIO_DURATIONS?.['Level 1'] || 30;
        if (filename.includes('Level 2')) return CONFIG.AUDIO_DURATIONS?.['Level 2'] || 20;
        if (filename.includes('Level 3')) return CONFIG.AUDIO_DURATIONS?.['Level 3'] || 10;
        return CONFIG.AUDIO_DURATIONS?.FALLBACK || 15;
    }

    /**
     * ✅ CORRIGÉ : Sélectionne un morceau aléatoire pour une room
     */
    selectRandomSong(room) {
        try {
            const allFiles = this.audioCache.get('all_level1_files') || [];

            if (allFiles.length === 0) {
                console.error('❌ Aucun fichier audio disponible');
                return null;
            }

            let availableFiles = allFiles.filter(f => !room.playedSongs.has(f));

            // ✅ AMÉLIORATION : Gestion du mode rapide avec cache de sélection
            if (room.gameMode === GAME_MODES.QUICK) {
                if (!room.quickModeSelection) {
                    // Créer une sélection aléatoire permanente pour cette room
                    const shuffledFiles = [...allFiles].sort(() => Math.random() - 0.5);
                    room.quickModeSelection = shuffledFiles.slice(0, Math.min(room.maxRounds, allFiles.length));
                    console.log(`🎲 Sélection rapide créée pour room ${room.code}: ${room.quickModeSelection.length} morceaux`);
                }
                availableFiles = room.quickModeSelection.filter(f => !room.playedSongs.has(f));
            }

            // ✅ CORRECTION : Éviter la récursion infinie
            if (availableFiles.length === 0) {
                if (room.playedSongs.size > 0) {
                    console.log(`🔄 Reset des morceaux joués pour room ${room.code} (${room.playedSongs.size} morceaux joués)`);
                    room.playedSongs.clear();
                    // Appel récursif unique
                    return this.selectRandomSong(room);
                } else {
                    console.error(`❌ Aucun morceau disponible pour room ${room.code} même après reset`);
                    return null;
                }
            }

            const selectedFile = availableFiles[Math.floor(Math.random() * availableFiles.length)];
            const artist = this.extractArtistFromFilename(selectedFile);

            room.playedSongs.add(selectedFile);

            // ✅ CORRECTION CRITIQUE : URLs corrigées
            const level2File = selectedFile.replace('Level 1 -', 'Level 2 -');
            const level3File = selectedFile.replace('Level 1 -', 'Level 3 -');

            const songData = {
                artist,
                level1File: selectedFile,
                level2File: level2File,
                level3File: level3File,
                level1Url: this.generateAudioUrl(selectedFile),
                level2Url: this.generateAudioUrl(level2File),
                level3Url: this.generateAudioUrl(level3File)
            };

            console.log(`🎵 Morceau sélectionné pour room ${room.code}:`);
            console.log(`   📀 Artiste: "${artist}"`);
            console.log(`   🎶 Level 1 URL: ${songData.level1Url}`);
            console.log(`   📊 Progression: ${room.playedSongs.size}/${allFiles.length} morceaux joués`);

            return songData;

        } catch (error) {
            console.error('❌ Erreur sélection morceau:', error);
            return null;
        }
    }

    /**
     * Extrait le nom de l'artiste depuis le nom de fichier
     */
    extractArtistFromFilename(filename) {
        return filename.replace('Level 1 - ', '').replace('.mp3', '');
    }

    /**
     * Valide si les fichiers audio existent pour un morceau
     */
    validateSongFiles(songData) {
        try {
            const audioDir = this.audioCache.get('audio_dir');
            if (!audioDir) return false;

            const files = [songData.level1File, songData.level2File, songData.level3File];

            return files.every(file => {
                const filepath = path.join(audioDir, file);
                const exists = fs.existsSync(filepath);
                if (!exists) {
                    console.warn(`⚠️ Fichier audio manquant: ${file}`);
                }
                return exists;
            });
        } catch (error) {
            console.error('❌ Erreur validation fichiers audio:', error);
            return false;
        }
    }

    /**
     * ✅ NOUVEAU : Obtient des statistiques sur les fichiers audio
     */
    getAudioStats() {
        try {
            const audioDir = this.audioCache.get('audio_dir');
            if (!audioDir) {
                return { totalFiles: 0, level1Count: 0, level2Count: 0, level3Count: 0, completeArtists: 0 };
            }

            const files = fs.readdirSync(audioDir);

            const level1Count = files.filter(f => f.startsWith('Level 1 -')).length;
            const level2Count = files.filter(f => f.startsWith('Level 2 -')).length;
            const level3Count = files.filter(f => f.startsWith('Level 3 -')).length;

            return {
                totalFiles: files.length,
                level1Count,
                level2Count,
                level3Count,
                completeArtists: Math.min(level1Count, level2Count, level3Count),
                audioDir
            };
        } catch (error) {
            return { totalFiles: 0, level1Count: 0, level2Count: 0, level3Count: 0, completeArtists: 0 };
        }
    }

    /**
     * ✅ NOUVEAU : Refresh le cache (utile si de nouveaux fichiers sont ajoutés)
     */
    refreshCache() {
        console.log('🔄 Refresh du cache AudioManager...');
        this.audioCache.clear();
        this.totalArtistsCache.clear();
        this.initializeCache();
    }

    /**
     * ✅ NOUVEAU : Vérifie si l'audio est disponible
     */
    isAudioAvailable() {
        const allFiles = this.audioCache.get('all_level1_files') || [];
        return allFiles.length > 0;
    }

    /**
     * ✅ NOUVEAU : Debug - Liste tous les fichiers disponibles
     */
    listAvailableFiles() {
        const allFiles = this.audioCache.get('all_level1_files') || [];
        const audioDir = this.audioCache.get('audio_dir');

        console.log(`📁 Dossier audio: ${audioDir}`);
        console.log(`🎵 Fichiers disponibles (${allFiles.length}):`);
        allFiles.forEach((file, index) => {
            const artist = this.extractArtistFromFilename(file);
            const url = this.generateAudioUrl(file);
            console.log(`   ${index + 1}. "${artist}" → ${url}`);
        });
    }
}

// Singleton pattern pour éviter les rechargements multiples
const audioManager = new AudioManager();

module.exports = audioManager;