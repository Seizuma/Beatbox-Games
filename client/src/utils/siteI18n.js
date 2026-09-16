import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// Même clé que useI18n : la langue choisie sur le site est reprise dans les jeux
const STORAGE_KEY = 'beatbox_language';
const SUPPORTED = ['fr', 'en'];

const strings = {
    fr: {
        nav: {
            label: 'Navigation principale',
            games: 'Jeux',
            rankings: 'Classements',
            artists: 'Artistes',
            profile: 'Profil',
        },
        lang: {
            label: 'Langue du site',
        },
        theme: {
            toNight: 'Passer au thème nuit',
            toDay: 'Passer au thème jour',
        },
        account: {
            login: 'Se connecter avec Discord',
            loginShort: 'Discord',
            loading: 'Connexion…',
            profile: 'Voir le profil de {name}',
        },
        footer: {
            contact: 'Contact',
            privacy: 'Confidentialité',
            legal: 'Mentions légales',
            madeBy: 'Un projet de Seizuma pour la communauté beatbox',
        },
        common: {
            loading: 'Chargement…',
            loadError: 'Impossible de charger les données. Recharge la page pour réessayer.',
            close: 'Fermer',
            cancel: 'Annuler',
            points: '{value} pts',
            you: 'toi',
            today: 'Aujourd’hui',
            yesterday: 'Hier',
        },
        hub: {
            title: 'Les jeux beatbox à jouer entre amis',
            intro: 'Crée une salle, envoie le code, jouez ensemble. Jusqu’à 10 joueurs, rien à installer.',
            seoTitle: 'BeatBox Games — Blind Test et Buzzer Battle beatbox entre amis',
            seoDescription: 'Deux jeux multijoueurs gratuits autour des plus grands beatboxers : Blind Test et Buzzer Battle. Crée une salle, partage le code et joue avec jusqu’à 10 amis.',
        },
        games: {
            create: 'Créer une salle',
            all: 'Tous les jeux',
            players: 'Jusqu’à 10 joueurs',
            blindtest: {
                kicker: 'À l’oreille',
                meta: '3 extraits par manche',
                name: 'Blind Test',
                description: 'Écoute l’extrait et trouve le beatboxer. Trois extraits par manche, de plus en plus reconnaissables : 5, 3 puis 1 point.',
                screenLabel: 'Manche 3 sur 10, niveau 2',
            },
            buzzer: {
                kicker: 'À l’image',
                meta: '10 s pour répondre',
                name: 'Buzzer Battle',
                description: 'Une photo floue se précise. Le premier qui buzze donne le nom : +2 si c’est juste, −1 sinon.',
            },
        },
        join: {
            title: 'Rejoindre une salle',
            game: 'Jeu de la salle',
            code: 'Code de salle',
            placeholder: 'CODE',
            submit: 'Rejoindre',
            help: 'Le code est donné par l’hôte de la salle.',
            invalid: 'Entre le code complet donné par l’hôte : 4 à 8 lettres ou chiffres.',
        },
        ranking: {
            title: 'Classement général',
            seeAll: 'Tout voir',
            loading: 'Chargement du classement…',
            empty: 'Personne n’est encore classé. Il faut 5 parties avec au moins un autre compte Discord pour apparaître ici.',
            hint: 'Cote de classement, parties à plusieurs uniquement',
            error: 'Le classement n’a pas pu être chargé. Recharge la page pour réessayer.',
            avatarAlt: 'Avatar de {name}',
        },
        stats: {
            seoTitle: 'Classements et statistiques — BeatBox Games',
            seoDescription: 'Classements des joueurs, beatboxers les plus faciles et les plus durs à reconnaître, statistiques du Blind Test et du Buzzer Battle.',
            title: 'Classements',
            intro: 'Les meilleurs joueurs connectés avec Discord, et ce que les parties disent des beatboxers.',
            gameTabs: 'Choix du jeu',
            leaderboard: 'Classement des joueurs',
            sortNote: 'Trié par cote de classement.',
            rating: 'Cote',
            rankedGames: 'Parties classées',
            howTitle: 'Comment fonctionne le classement',
            how1: 'Seules les parties avec au moins {players} comptes Discord et {rounds} manches comptent. Jouer seul ne rapporte rien.',
            how2: 'Chaque joueur a une cote qui démarre à {start}. Battre un adversaire mieux coté la fait beaucoup monter, battre un adversaire moins bien coté la fait peu monter, perdre la fait baisser.',
            how3: 'Tu apparais dans le classement après {placement} parties classées.',
            how4: 'Tes statistiques personnelles, elles, comptent toutes tes parties.',
            filterNote: 'Ce filtre s’applique aux statistiques des beatboxers.',
            rank: 'Rang',
            player: 'Joueur',
            games: 'Parties',
            wins: 'Victoires',
            points: 'Points',
            emptyLeaderboard: 'Aucun joueur classé pour l’instant. Il faut {placement} parties classées pour apparaître ici.',
            category: 'Type de partie',
            categoryAll: 'Toutes',
            categoryFull: 'Tous les artistes',
            categorySelection: 'Sélection',
            filter: 'Filtre',
            filterAll: 'Toutes',
            filterCountry: 'Par pays',
            filterEvent: 'Par événement',
            filterValue: 'Valeur du filtre',
            choose: 'Choisir…',
            figures: 'En chiffres',
            players: 'joueurs',
            rounds: 'manches jouées',
            answers: 'réponses',
            successRate: 'de réponses justes',
            reaction: 'de temps de réaction moyen',
            levels: 'Trouvé à quel extrait ?',
            levelsHelp: 'Part des manches où l’artiste a été trouvé dès cet extrait.',
            level: 'Extrait {level}',
            hardest: 'Les plus durs à reconnaître',
            easiest: 'Les plus faciles',
            allArtists: 'Tous les artistes',
            allBeatboxers: 'Tous les beatboxers',
            helpBlindtest: 'Score de reconnaissance : 100 % si l’artiste est toujours trouvé au premier extrait.',
            helpBuzzer: 'Part des buzz avec la bonne réponse.',
            roundsCount: '{count} manches',
            searchArtist: 'Rechercher un artiste',
            showAll: 'Voir les {count}',
            showLess: 'Réduire la liste',
            noData: 'Pas encore assez de parties pour afficher ces données.',
            noMatch: 'Aucun artiste ne correspond à cette recherche.',
        },
        profile: {
            seoTitle: 'Mon profil — BeatBox Games',
            title: 'Profil',
            guestTitle: 'Connecte-toi pour garder tes scores',
            guestText: 'La connexion Discord enregistre tes parties, tes victoires et ta place dans les classements. Tu peux jouer sans compte.',
            connecting: 'Connexion en cours…',
            connectedWith: 'Connecté avec Discord',
            games: 'parties',
            wins: 'victoires',
            points: 'points',
            average: 'points par partie',
            roundsWon: 'manches gagnées',
            correctGuesses: 'bonnes réponses',
            rankingTitle: 'Classement',
            rankingHelp: 'Seules les parties avec au moins un autre compte Discord comptent.',
            rating: 'cote',
            position: 'place au classement',
            rankedGames: 'parties classées',
            peak: 'meilleure cote',
            placement: 'Encore {count} parties classées avant d’apparaître au classement.',
            personalTitle: 'Toutes tes parties',
            recent: 'Dernières parties',
            noGames: 'Aucune partie enregistrée pour l’instant.',
            room: 'Salle {room}',
            rankOf: '{rank} sur {total}',
            gameDetail: 'Détail de la partie',
            participants: 'Participants',
            noParticipants: 'Les participants de cette partie ne sont pas disponibles.',
            account: 'Compte',
            logout: 'Se déconnecter',
            delete: 'Supprimer mon compte',
            deleteTitle: 'Supprimer ton compte ?',
            deleteText: 'Ton compte BeatBox Games sera supprimé et tu seras déconnecté. Cette action est définitive.',
            deleteConfirm: 'Supprimer définitivement',
            deleteError: 'La suppression a échoué. Réessaie ou écris-nous.',
        },
        credits: {
            seoTitle: 'Les artistes — BeatBox Games',
            seoDescription: 'Tous les beatboxers que l’on peut entendre dans le Blind Test de BeatBox Games, et les crédits audio du site.',
            title: 'Les {count} artistes',
            intro: 'Tous les beatboxers qu’on peut entendre dans le Blind Test. Merci à eux pour leur talent.',
            search: 'Rechercher un artiste',
            count: '{count} sur {total}',
            empty: 'Aucun artiste ne correspond à « {query} ».',
            audioTitle: 'Crédits audio',
            music: 'Musique d’ambiance',
            by: 'par',
            license: 'Licence',
            removal: 'Tu es artiste et tu souhaites retirer ton extrait ?',
            removalLink: 'Écris-nous',
        },
        contact: {
            seoTitle: 'Contact — BeatBox Games',
            title: 'Écrire à l’équipe',
            intro: 'Un bug, une idée ? Chaque message est lu.',
            loginTitle: 'Connexion Discord requise',
            loginText: 'Pour éviter le spam, il faut être connecté avec Discord pour envoyer un message.',
            loggedAs: 'Connecté en tant que {name}',
            type: 'Type de message',
            bug: 'Signaler un bug',
            bugHelp: 'Quelque chose ne fonctionne pas',
            suggestion: 'Suggestion',
            suggestionHelp: 'Une idée pour améliorer le site',
            category: 'Concerne',
            other: 'Le site',
            details: 'Détails',
            placeholderBug: 'Ce qui s’est passé, sur quel appareil, et comment le reproduire.',
            placeholderSuggestion: 'Ton idée, et ce qu’elle apporterait.',
            counter: '{count} / {max}',
            minLength: '{min} caractères minimum',
            remaining: 'Encore {count} envois aujourd’hui pour cette catégorie.',
            limitReached: 'Limite du jour atteinte pour cette catégorie.',
            send: 'Envoyer le message',
            sending: 'Envoi…',
            success: 'Message envoyé, merci !',
            error: 'L’envoi a échoué. Réessaie dans un instant.',
            rateLimited: 'Limite du jour atteinte pour cette catégorie. Réessaie demain.',
            authRequired: 'Ta session Discord a expiré. Reconnecte-toi puis réessaie.',
            tooShort: 'Ton message doit faire au moins 10 caractères.',
            tooLong: 'Ton message ne peut pas dépasser 2000 caractères.',
            email: 'Tu peux aussi écrire à',
        },
        legal: {
            tabs: 'Documents',
            legal: 'Mentions légales',
            privacy: 'Confidentialité',
            toc: 'Sur cette page',
        },
        notFound: {
            seoTitle: 'Page introuvable — BeatBox Games',
            title: 'Page introuvable',
            text: 'Cette adresse ne mène nulle part. Le lien est peut-être incomplet, ou la page a changé de place.',
            home: 'Retour aux jeux',
            rankings: 'Voir les classements',
        },
    },

    en: {
        nav: {
            label: 'Main navigation',
            games: 'Games',
            rankings: 'Rankings',
            artists: 'Artists',
            profile: 'Profile',
        },
        lang: {
            label: 'Site language',
        },
        theme: {
            toNight: 'Switch to night theme',
            toDay: 'Switch to day theme',
        },
        account: {
            login: 'Log in with Discord',
            loginShort: 'Discord',
            loading: 'Logging in…',
            profile: 'View {name}’s profile',
        },
        footer: {
            contact: 'Contact',
            privacy: 'Privacy',
            legal: 'Legal notice',
            madeBy: 'A Seizuma project for the beatbox community',
        },
        common: {
            loading: 'Loading…',
            loadError: 'The data couldn’t be loaded. Reload the page to try again.',
            close: 'Close',
            cancel: 'Cancel',
            points: '{value} pts',
            you: 'you',
            today: 'Today',
            yesterday: 'Yesterday',
        },
        hub: {
            title: 'Beatbox games to play with friends',
            intro: 'Create a room, send the code, play together. Up to 10 players, nothing to install.',
            seoTitle: 'BeatBox Games — Beatbox Blind Test and Buzzer Battle with friends',
            seoDescription: 'Two free multiplayer games about the greatest beatboxers: Blind Test and Buzzer Battle. Create a room, share the code and play with up to 10 friends.',
        },
        games: {
            create: 'Create a room',
            all: 'All games',
            players: 'Up to 10 players',
            blindtest: {
                kicker: 'By ear',
                meta: '3 clips per round',
                name: 'Blind Test',
                description: 'Listen to the clip and name the beatboxer. Three clips per round, each easier to recognise: 5, 3, then 1 point.',
                screenLabel: 'Round 3 of 10, level 2',
            },
            buzzer: {
                kicker: 'By sight',
                meta: '10 s to answer',
                name: 'Buzzer Battle',
                description: 'A blurred photo slowly sharpens. First to buzz names the beatboxer: +2 if right, −1 if wrong.',
            },
        },
        join: {
            title: 'Join a room',
            game: 'Room game',
            code: 'Room code',
            placeholder: 'CODE',
            submit: 'Join',
            help: 'The room host gives you the code.',
            invalid: 'Enter the full code from the host: 4 to 8 letters or numbers.',
        },
        ranking: {
            title: 'Overall ranking',
            seeAll: 'See all',
            loading: 'Loading ranking…',
            empty: 'Nobody is ranked yet. Play 5 games with at least one other Discord account to show up here.',
            hint: 'Ranking rating, multiplayer games only',
            error: 'The ranking couldn’t be loaded. Reload the page to try again.',
            avatarAlt: '{name}’s avatar',
        },
        stats: {
            seoTitle: 'Rankings and statistics — BeatBox Games',
            seoDescription: 'Player rankings, easiest and hardest beatboxers to recognise, Blind Test and Buzzer Battle statistics.',
            title: 'Rankings',
            intro: 'The best players logged in with Discord, and what the games say about the beatboxers.',
            gameTabs: 'Choose a game',
            leaderboard: 'Player ranking',
            sortNote: 'Sorted by ranking rating.',
            rating: 'Rating',
            rankedGames: 'Ranked games',
            howTitle: 'How the ranking works',
            how1: 'Only games with at least {players} Discord accounts and {rounds} rounds count. Playing alone earns nothing.',
            how2: 'Every player has a rating starting at {start}. Beating a higher-rated opponent raises it a lot, beating a lower-rated one raises it a little, losing lowers it.',
            how3: 'You show up in the ranking after {placement} ranked games.',
            how4: 'Your personal statistics still count all your games.',
            filterNote: 'This filter applies to the beatboxer statistics.',
            rank: 'Rank',
            player: 'Player',
            games: 'Games',
            wins: 'Wins',
            points: 'Points',
            emptyLeaderboard: 'No ranked players yet. It takes {placement} ranked games to show up here.',
            category: 'Game type',
            categoryAll: 'All',
            categoryFull: 'All artists',
            categorySelection: 'Selection',
            filter: 'Filter',
            filterAll: 'All',
            filterCountry: 'By country',
            filterEvent: 'By event',
            filterValue: 'Filter value',
            choose: 'Choose…',
            figures: 'In numbers',
            players: 'players',
            rounds: 'rounds played',
            answers: 'answers',
            successRate: 'correct answers',
            reaction: 'average reaction time',
            levels: 'Found on which clip?',
            levelsHelp: 'Share of rounds where the artist was found on this clip.',
            level: 'Clip {level}',
            hardest: 'Hardest to recognise',
            easiest: 'Easiest',
            allArtists: 'All artists',
            allBeatboxers: 'All beatboxers',
            helpBlindtest: 'Recognition score: 100% if the artist is always found on the first clip.',
            helpBuzzer: 'Share of buzzes with the right answer.',
            roundsCount: '{count} rounds',
            searchArtist: 'Search for an artist',
            showAll: 'Show all {count}',
            showLess: 'Show less',
            noData: 'Not enough games yet to show this data.',
            noMatch: 'No artist matches this search.',
        },
        profile: {
            seoTitle: 'My profile — BeatBox Games',
            title: 'Profile',
            guestTitle: 'Log in to keep your scores',
            guestText: 'Logging in with Discord saves your games, your wins and your place in the rankings. You can play without an account.',
            connecting: 'Logging in…',
            connectedWith: 'Logged in with Discord',
            games: 'games',
            wins: 'wins',
            points: 'points',
            average: 'points per game',
            roundsWon: 'rounds won',
            correctGuesses: 'correct answers',
            rankingTitle: 'Ranking',
            rankingHelp: 'Only games with at least one other Discord account count.',
            rating: 'rating',
            position: 'ranking position',
            rankedGames: 'ranked games',
            peak: 'best rating',
            placement: '{count} more ranked games before you show up in the ranking.',
            personalTitle: 'All your games',
            recent: 'Recent games',
            noGames: 'No games recorded yet.',
            room: 'Room {room}',
            rankOf: '{rank} of {total}',
            gameDetail: 'Game details',
            participants: 'Players',
            noParticipants: 'The players of this game aren’t available.',
            account: 'Account',
            logout: 'Log out',
            delete: 'Delete my account',
            deleteTitle: 'Delete your account?',
            deleteText: 'Your BeatBox Games account will be deleted and you will be logged out. This can’t be undone.',
            deleteConfirm: 'Delete permanently',
            deleteError: 'Deletion failed. Try again or contact us.',
        },
        credits: {
            seoTitle: 'The artists — BeatBox Games',
            seoDescription: 'Every beatboxer you can hear in the BeatBox Games Blind Test, and the site’s audio credits.',
            title: 'The {count} artists',
            intro: 'Every beatboxer you can hear in the Blind Test. Thanks to them for their talent.',
            search: 'Search for an artist',
            count: '{count} of {total}',
            empty: 'No artist matches “{query}”.',
            audioTitle: 'Audio credits',
            music: 'Background music',
            by: 'by',
            license: 'License',
            removal: 'Are you an artist and want your clip removed?',
            removalLink: 'Contact us',
        },
        contact: {
            seoTitle: 'Contact — BeatBox Games',
            title: 'Contact the team',
            intro: 'A bug, an idea? Every message gets read.',
            loginTitle: 'Discord login required',
            loginText: 'To prevent spam, you need to be logged in with Discord to send a message.',
            loggedAs: 'Logged in as {name}',
            type: 'Message type',
            bug: 'Report a bug',
            bugHelp: 'Something isn’t working',
            suggestion: 'Suggestion',
            suggestionHelp: 'An idea to improve the site',
            category: 'About',
            other: 'The site',
            details: 'Details',
            placeholderBug: 'What happened, on which device, and how to reproduce it.',
            placeholderSuggestion: 'Your idea, and what it would bring.',
            counter: '{count} / {max}',
            minLength: '{min} characters minimum',
            remaining: '{count} messages left today for this category.',
            limitReached: 'Daily limit reached for this category.',
            send: 'Send message',
            sending: 'Sending…',
            success: 'Message sent, thank you!',
            error: 'Sending failed. Try again in a moment.',
            rateLimited: 'Daily limit reached for this category. Try again tomorrow.',
            authRequired: 'Your Discord session has expired. Log in again and retry.',
            tooShort: 'Your message must be at least 10 characters long.',
            tooLong: 'Your message can’t exceed 2000 characters.',
            email: 'You can also write to',
        },
        legal: {
            tabs: 'Documents',
            legal: 'Legal notice',
            privacy: 'Privacy',
            toc: 'On this page',
        },
        notFound: {
            seoTitle: 'Page not found — BeatBox Games',
            title: 'Page not found',
            text: 'This address doesn’t lead anywhere. The link may be incomplete, or the page has moved.',
            home: 'Back to the games',
            rankings: 'See the rankings',
        },
    },
};

const lookup = (dictionary, key) =>
    key.split('.').reduce((value, part) => (value == null ? undefined : value[part]), dictionary);

const interpolate = (text, variables) =>
    text.replace(/\{(\w+)\}/g, (match, name) => (variables[name] !== undefined ? variables[name] : match));

const readInitialLanguage = () => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (SUPPORTED.includes(saved)) return saved;
    } catch (error) {
        // localStorage indisponible (navigation privée stricte) : on se rabat sur le navigateur
    }
    const browser = (typeof navigator !== 'undefined' && navigator.language) || 'fr';
    return browser.toLowerCase().startsWith('fr') ? 'fr' : 'en';
};

const SiteI18nContext = createContext(null);

export function SiteI18nProvider({ children }) {
    const [language, setLanguage] = useState(readInitialLanguage);

    useEffect(() => {
        document.documentElement.lang = language;
    }, [language]);

    const switchLanguage = useCallback((next) => {
        if (!SUPPORTED.includes(next)) return;
        // Écriture immédiate : les contenus encore traduits par useI18n se remontent avec la nouvelle langue
        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch (error) {
            // La langue reste valable pour la session
        }
        setLanguage(next);
    }, []);

    const t = useCallback((key, variables = {}) => {
        const value = lookup(strings[language], key) ?? lookup(strings.fr, key);
        return typeof value === 'string' ? interpolate(value, variables) : key;
    }, [language]);

    const value = useMemo(() => ({ language, switchLanguage, t }), [language, switchLanguage, t]);

    return <SiteI18nContext.Provider value={value}>{children}</SiteI18nContext.Provider>;
}

export function useSiteI18n() {
    const context = useContext(SiteI18nContext);
    if (!context) {
        throw new Error('useSiteI18n doit être utilisé à l’intérieur de SiteI18nProvider (SiteShell).');
    }
    return context;
}

// Formats partagés par les pages de la chaîne
export const formatNumber = (language, value) =>
    new Intl.NumberFormat(language === 'fr' ? 'fr-FR' : 'en-GB').format(value || 0);

export const formatOrdinal = (language, rank) => {
    if (language === 'fr') return rank === 1 ? '1er' : `${rank}e`;
    const suffix = rank % 100 >= 11 && rank % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[rank % 10] || 'th');
    return `${rank}${suffix}`;
};

export const formatDay = (language, dateString, t) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diffDays = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);
    if (diffDays === 0) return t('common.today');
    if (diffDays === 1) return t('common.yesterday');
    return date.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short', year: diffDays > 300 ? 'numeric' : undefined });
};