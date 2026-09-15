import React from 'react';

// Écran de secours si un composant plante : évite la page blanche.
// Il s'affiche hors des providers du site, d'où la lecture directe de la langue et du thème.
const readStorage = (key, fallback) => {
    try {
        return localStorage.getItem(key) || fallback;
    } catch (error) {
        return fallback;
    }
};

const TEXTS = {
    fr: {
        title: 'Quelque chose s’est mal passé',
        text: 'Cette page a rencontré une erreur. Recharge-la ; si le problème revient, écris-nous à contact@beatboxgames.com.',
        reload: 'Recharger la page',
        home: 'Retour aux jeux',
    },
    en: {
        title: 'Something went wrong',
        text: 'This page hit an error. Reload it; if the problem comes back, write to us at contact@beatboxgames.com.',
        reload: 'Reload the page',
        home: 'Back to the games',
    },
};

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, info) {
        console.error('Erreur d’affichage interceptée:', error, info?.componentStack);
    }

    componentDidUpdate(previousProps) {
        // Changer de page efface l'erreur
        if (this.state.hasError && previousProps.resetKey !== this.props.resetKey) {
            this.setState({ hasError: false });
        }
    }

    render() {
        if (!this.state.hasError) {
            return this.props.children;
        }

        const language = readStorage('beatbox_language', 'fr') === 'en' ? 'en' : 'fr';
        const theme = readStorage('beatbox_site_theme', 'night') === 'day' ? 'day' : 'night';
        const text = TEXTS[language];

        return (
            <div data-site-theme={theme} className="flex min-h-screen items-center justify-center bg-site-paper px-6 font-site text-site-ink">
                <div role="alert" className="max-w-md text-center">
                    <h1 className="text-2xl font-bold sm:text-3xl">{text.title}</h1>
                    <p className="mt-3 text-site-muted">{text.text}</p>
                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="rounded-lg bg-site-button px-4 py-2.5 text-sm font-bold text-site-on-button transition-colors hover:bg-site-button-hover"
                        >
                            {text.reload}
                        </button>
                        <a
                            href="/#/"
                            className="rounded-lg border border-site-line bg-site-surface px-4 py-2.5 text-sm font-bold text-site-ink transition-colors hover:bg-site-tint"
                        >
                            {text.home}
                        </a>
                    </div>
                </div>
            </div>
        );
    }
}

export default ErrorBoundary;