// Textes du plateau (Blind Test, puis Buzzer Battle) sans emojis.
// Remplace progressivement les clés de i18n.js côté jeux, qui seront nettoyées une fois tous les écrans migrés.

export const LEVEL_POINTS = { 1: 5, 2: 3, 3: 1 };
export const MAX_PLAYERS = 10;

const strings = {
    fr: {
        common: {
            quit: 'Quitter le plateau',
            howToPlay: 'Comment jouer ?',
            close: 'Fermer',
            understood: 'C’est parti',
            language: 'Langue',
            volume: 'Volume',
            volumeValue: 'Volume : {value} %',
            offline: 'hors ligne',
            host: 'Hôte',
            cancel: 'Annuler',
            save: 'Valider',
        },
        modes: {
            normal: 'Mode normal',
            quick: 'Mode rapide',
        },
        blindtest: {
            name: 'Blind Test',
            tagline: 'Trouve le beatboxer en trois extraits',
        },
        rules: {
            title: 'Comment jouer ?',
            step1: 'Un extrait d’un beatboxer se lance pour tout le monde en même temps.',
            step2: 'Tape le nom du beatboxer avant la fin du temps. Une seule réponse par extrait.',
            step3: 'Chaque manche compte trois extraits, du plus difficile au plus facile.',
            step4: 'Trouver au premier extrait rapporte 5 points, au deuxième 3 points, au troisième 1 point.',
            step5: 'Une fois l’artiste trouvé, tu attends la manche suivante.',
            step6: 'Le joueur qui a le plus de points à la fin de la partie gagne.',
        },
        create: {
            nameLabel: 'Ton nom sur le pupitre',
            namePlaceholder: 'Ton pseudo',
            create: 'Créer la salle',
            or: 'ou',
            codeLabel: 'Code de salle',
            codePlaceholder: 'CODE',
            join: 'Rejoindre',
            codeHelp: '5 lettres ou chiffres, donnés par l’hôte.',
            invited: 'Tu es invité dans la salle {room}.',
        },
        loading: {
            connecting: 'Connexion au plateau…',
            joining: 'Entrée dans la salle {room}',
        },
        lobby: {
            roomCode: 'Code de la salle',
            copyCode: 'Copier le code',
            codeCopied: 'Code copié',
            shareLink: 'Partager le lien',
            linkCopied: 'Lien copié',
            copyFailed: 'Copie impossible',
            shareText: 'Rejoins ma salle de Blind Test beatbox : {room}',
            artists: '{count} artistes',
            answerTime: '{seconds} s pour répondre',
            settings: 'Réglages',
            players: 'Joueurs ({count} sur {max})',
            ready: 'prêt',
            waiting: 'en attente',
            setReady: 'Je suis prêt',
            unsetReady: 'Je ne suis plus prêt',
            start: 'Lancer la partie',
            hostHint: 'Tout le monde est prêt, tu peux lancer la partie.',
            waitingHost: '{host} lance la partie quand tout le monde est prêt.',
            notAllReady: 'Tous les joueurs doivent être prêts pour lancer la partie.',
            editName: 'Changer de nom',
            newNameLabel: 'Nouveau nom',
        },
        settings: {
            title: 'Réglages de la salle',
            artistCount: 'Nombre d’artistes',
            artistHelp: 'Entre {min} et {max}. Appliqué au lancement de la partie.',
            answerTime: 'Temps de réponse',
            answerHelp: 'Entre {min} et {max} secondes par extrait.',
            players: 'Joueurs',
            makeHost: 'Nommer hôte',
            makeHostLabel: 'Nommer {name} hôte',
            kick: 'Exclure',
            kickLabel: 'Exclure {name}',
            noOthers: 'Aucun autre joueur pour l’instant.',
        },
        game: {
            round: 'Manche {round} sur {max}',
            level: 'Niveau {level} : {points} pts',
            seconds: 'secondes',
            listen: 'Écoute bien',
            answerLabel: 'Ta réponse',
            answerPlaceholder: 'Nom du beatboxer',
            submit: 'Valider',
            correct: 'Bonne réponse !',
            wrong: 'Ce n’est pas la bonne réponse.',
            found: 'Trouvé ! Attends la manche suivante.',
            sent: 'Réponse envoyée',
            listenHint: 'L’extrait démarre, prépare ta réponse.',
            locked: 'Attends le prochain extrait.',
            syncing: 'Synchronisation…',
            scores: 'Scores',
            legend: 'Lampe verte : trouvé. Lampe rouge : mauvaise réponse.',
        },
        results: {
            title: 'Partie terminée',
            titleRoom: 'Partie terminée dans la salle {room}',
            winner: '{name} gagne',
            winnerScore: 'avec {score} points',
            ranking: 'Classement final',
            you: 'toi',
            newGame: 'Nouvelle partie',
            back: 'Retour à BeatBox Games',
            discordNote: 'Les scores des comptes Discord sont ajoutés au classement du site.',
            empty: 'Aucun résultat à afficher pour cette partie.',
        },
        notices: {
            audioUnlock: 'Touche l’écran pour activer le son',
            sharedLinkHint: 'Le serveur peut te proposer un autre pseudo automatiquement.',
        },
    },

    en: {
        common: {
            quit: 'Leave the stage',
            howToPlay: 'How to play',
            close: 'Close',
            understood: 'Let’s go',
            language: 'Language',
            volume: 'Volume',
            volumeValue: 'Volume: {value}%',
            offline: 'offline',
            host: 'Host',
            cancel: 'Cancel',
            save: 'Save',
        },
        modes: {
            normal: 'Normal mode',
            quick: 'Quick mode',
        },
        blindtest: {
            name: 'Blind Test',
            tagline: 'Name the beatboxer in three clips',
        },
        rules: {
            title: 'How to play',
            step1: 'A clip of a beatboxer plays for everyone at the same time.',
            step2: 'Type the beatboxer’s name before time runs out. One answer per clip.',
            step3: 'Each round has three clips, from hardest to easiest.',
            step4: 'Guessing on the first clip earns 5 points, on the second 3 points, on the third 1 point.',
            step5: 'Once you’ve found the artist, you wait for the next round.',
            step6: 'The player with the most points at the end of the game wins.',
        },
        create: {
            nameLabel: 'Your name on the desk',
            namePlaceholder: 'Your nickname',
            create: 'Create the room',
            or: 'or',
            codeLabel: 'Room code',
            codePlaceholder: 'CODE',
            join: 'Join',
            codeHelp: '5 letters or numbers, given by the host.',
            invited: 'You’re invited to room {room}.',
        },
        loading: {
            connecting: 'Connecting to the stage…',
            joining: 'Joining room {room}',
        },
        lobby: {
            roomCode: 'Room code',
            copyCode: 'Copy code',
            codeCopied: 'Code copied',
            shareLink: 'Share link',
            linkCopied: 'Link copied',
            copyFailed: 'Couldn’t copy',
            shareText: 'Join my beatbox Blind Test room: {room}',
            artists: '{count} artists',
            answerTime: '{seconds} s to answer',
            settings: 'Settings',
            players: 'Players ({count} of {max})',
            ready: 'ready',
            waiting: 'waiting',
            setReady: 'I’m ready',
            unsetReady: 'I’m not ready',
            start: 'Start the game',
            hostHint: 'Everyone is ready, you can start the game.',
            waitingHost: '{host} starts the game when everyone is ready.',
            notAllReady: 'Every player must be ready to start the game.',
            editName: 'Change name',
            newNameLabel: 'New name',
        },
        settings: {
            title: 'Room settings',
            artistCount: 'Number of artists',
            artistHelp: 'Between {min} and {max}. Applied when the game starts.',
            answerTime: 'Answer time',
            answerHelp: 'Between {min} and {max} seconds per clip.',
            players: 'Players',
            makeHost: 'Make host',
            makeHostLabel: 'Make {name} host',
            kick: 'Remove',
            kickLabel: 'Remove {name}',
            noOthers: 'No other players yet.',
        },
        game: {
            round: 'Round {round} of {max}',
            level: 'Level {level}: {points} pts',
            seconds: 'seconds',
            listen: 'Listen closely',
            answerLabel: 'Your answer',
            answerPlaceholder: 'Beatboxer name',
            submit: 'Submit',
            correct: 'Correct!',
            wrong: 'That’s not the right answer.',
            found: 'Found! Wait for the next round.',
            sent: 'Answer sent',
            listenHint: 'The clip is starting, get your answer ready.',
            locked: 'Wait for the next clip.',
            syncing: 'Syncing…',
            scores: 'Scores',
            legend: 'Green light: found. Red light: wrong answer.',
        },
        results: {
            title: 'Game over',
            titleRoom: 'Game over in room {room}',
            winner: '{name} wins',
            winnerScore: 'with {score} points',
            ranking: 'Final ranking',
            you: 'you',
            newGame: 'New game',
            back: 'Back to BeatBox Games',
            discordNote: 'Scores from Discord accounts are added to the site rankings.',
            empty: 'No results to show for this game.',
        },
        notices: {
            audioUnlock: 'Tap the screen to turn on sound',
            sharedLinkHint: 'The server may suggest another nickname automatically.',
        },
    },
};

const lookup = (dictionary, key) =>
    key.split('.').reduce((value, part) => (value == null ? undefined : value[part]), dictionary);

const interpolate = (text, variables) =>
    text.replace(/\{(\w+)\}/g, (match, name) => (variables[name] !== undefined ? variables[name] : match));

export function createShowT(language = 'fr') {
    const dictionary = strings[language] || strings.fr;
    return (key, variables = {}) => {
        const value = lookup(dictionary, key) ?? lookup(strings.fr, key);
        return typeof value === 'string' ? interpolate(value, variables) : key;
    };
}

// Retire les emojis des messages encore produits par i18n.js, les hooks ou le serveur
export function stripEmoji(text) {
    if (typeof text !== 'string') return text;
    return text
        .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}]/gu, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}