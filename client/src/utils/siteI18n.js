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
        hub: {
            title: 'Les jeux beatbox à jouer entre amis',
            intro: 'Crée une salle, envoie le code, jouez ensemble. Jusqu’à 10 joueurs, rien à installer.',
            seoTitle: 'BeatBox Games — Blind Test et Buzzer Battle beatbox entre amis',
            seoDescription: 'Deux jeux multijoueurs gratuits autour des plus grands beatboxers : Blind Test et Buzzer Battle. Crée une salle, partage le code et joue avec jusqu’à 10 amis.',
        },
        games: {
            create: 'Créer une salle',
            blindtest: {
                name: 'Blind Test',
                description: 'Écoute l’extrait et trouve le beatboxer. Trois extraits par manche, de plus en plus reconnaissables : 5, 3 puis 1 point.',
                screenLabel: 'Manche 3 sur 10, niveau 2',
            },
            buzzer: {
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
            points: '{value} pts',
            loading: 'Chargement du classement…',
            empty: 'Personne n’est encore classé. Connecte-toi avec Discord et joue trois parties pour apparaître ici.',
            error: 'Le classement n’a pas pu être chargé. Recharge la page pour réessayer.',
            avatarAlt: 'Avatar de {name}',
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
        hub: {
            title: 'Beatbox games to play with friends',
            intro: 'Create a room, send the code, play together. Up to 10 players, nothing to install.',
            seoTitle: 'BeatBox Games — Beatbox Blind Test and Buzzer Battle with friends',
            seoDescription: 'Two free multiplayer games about the greatest beatboxers: Blind Test and Buzzer Battle. Create a room, share the code and play with up to 10 friends.',
        },
        games: {
            create: 'Create a room',
            blindtest: {
                name: 'Blind Test',
                description: 'Listen to the clip and name the beatboxer. Three clips per round, each easier to recognise: 5, 3, then 1 point.',
                screenLabel: 'Round 3 of 10, level 2',
            },
            buzzer: {
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
            points: '{value} pts',
            loading: 'Loading ranking…',
            empty: 'Nobody is ranked yet. Log in with Discord and play three games to show up here.',
            error: 'The ranking couldn’t be loaded. Reload the page to try again.',
            avatarAlt: '{name}’s avatar',
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
        try {
            localStorage.setItem(STORAGE_KEY, language);
        } catch (error) {
            // Rien à faire : la langue reste valable pour la session
        }
        document.documentElement.lang = language;
    }, [language]);

    const switchLanguage = useCallback((next) => {
        if (SUPPORTED.includes(next)) setLanguage(next);
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