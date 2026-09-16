/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./src/**/*.{js,jsx}"],
    theme: {
        extend: {
            colors: {
                // Éléments partagés par le site et les jeux
                brand: {
                    ink: '#0F1B3D',
                    yellow: '#FFC72C',
                    live: '#E8402F',
                },
                // La chaîne : hub, classements, profil, artistes, contact, pages légales
                // Valeurs définies en variables CSS dans index.css (thèmes jour et nuit)
                site: {
                    paper: 'rgb(var(--site-paper) / <alpha-value>)',
                    surface: 'rgb(var(--site-surface) / <alpha-value>)',
                    ink: 'rgb(var(--site-ink) / <alpha-value>)',
                    muted: 'rgb(var(--site-muted) / <alpha-value>)',
                    soft: 'rgb(var(--site-soft) / <alpha-value>)',
                    line: 'rgb(var(--site-line) / <alpha-value>)',
                    tint: 'rgb(var(--site-tint) / <alpha-value>)',
                    highlight: 'rgb(var(--site-highlight) / <alpha-value>)',
                    button: 'rgb(var(--site-button) / <alpha-value>)',
                    'button-hover': 'rgb(var(--site-button-hover) / <alpha-value>)',
                    'on-button': 'rgb(var(--site-on-button) / <alpha-value>)',
                    danger: 'rgb(var(--site-danger) / <alpha-value>)',
                    success: 'rgb(var(--site-success) / <alpha-value>)',
                },
                // Le plateau : Blind Test et Buzzer Battle.
                // Mêmes variables CSS que le site, avec un jeu de valeurs « plateau de nuit »
                // et un jeu « plateau éclairé » (index.css, [data-show-theme]).
                // Note : `show.white` reste le nom historique de la couleur du texte sur le
                // plateau ; en thème jour elle devient l'encre foncée.
                show: {
                    night: 'rgb(var(--show-night) / <alpha-value>)',
                    stage: 'rgb(var(--show-stage) / <alpha-value>)',
                    'stage-2': 'rgb(var(--show-stage-2) / <alpha-value>)',
                    desk: 'rgb(var(--show-desk) / <alpha-value>)',
                    dim: 'rgb(var(--show-dim) / <alpha-value>)',
                    yellow: 'rgb(var(--show-yellow) / <alpha-value>)',
                    'yellow-deep': 'rgb(var(--show-yellow-deep) / <alpha-value>)',
                    white: 'rgb(var(--show-ink) / <alpha-value>)',
                    buzz: 'rgb(var(--show-buzz) / <alpha-value>)',
                    'buzz-deep': 'rgb(var(--show-buzz-deep) / <alpha-value>)',
                    ready: 'rgb(var(--show-ready) / <alpha-value>)',
                    muted: 'rgb(var(--show-muted) / <alpha-value>)',
                },
            },
            fontFamily: {
                brand: ['"Bowlby One"', 'Impact', 'system-ui', 'sans-serif'],
                site: ['"Hanken Grotesk"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
                show: ['"Albert Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
            },
            borderRadius: {
                screen: '1rem',
            },
            boxShadow: {
                'show-btn': '0 3px 0 rgb(var(--show-yellow-deep))',
                'show-btn-light': '0 3px 0 rgb(var(--show-dim))',
                'show-buzz': '0 6px 0 rgb(var(--show-buzz-deep))',
            },
            maxWidth: {
                site: '72rem',
            },
        },
    },
    plugins: [],
};