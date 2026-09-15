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
                site: {
                    paper: '#F5F6FA',
                    surface: '#FFFFFF',
                    ink: '#0F1B3D',
                    muted: '#4A5573',
                    soft: '#8A93AB',
                    line: '#DFE3EE',
                    tint: '#E9ECF4',
                    highlight: '#FFF6D9',
                },
                // Le plateau : Blind Test et Buzzer Battle
                show: {
                    night: '#0A1B45',
                    stage: '#0E2A6B',
                    'stage-2': '#163A8F',
                    desk: '#2A4FB0',
                    dim: '#233F8A',
                    yellow: '#FFC72C',
                    'yellow-deep': '#C99400',
                    white: '#FFFFFF',
                    buzz: '#E8402F',
                    'buzz-deep': '#9E2518',
                    ready: '#2DBE6C',
                    muted: '#A9B8E0',
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
                'show-btn': '0 3px 0 #C99400',
                'show-btn-light': '0 3px 0 #9FB0D8',
                'show-buzz': '0 6px 0 #9E2518',
            },
            maxWidth: {
                site: '72rem',
            },
        },
    },
    plugins: [],
};