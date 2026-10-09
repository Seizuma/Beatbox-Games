import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Lectern from '../show/Lectern';
import { Equalizer } from '../show/GameHud';
import Icon from '../icons/Icon';
import { LEVEL_POINTS } from '../../utils/showI18n';
import { API_BASE_URL } from '../../utils/useApi';

const BLINDTEST_DESKS = [
    { name: 'Lina', score: 12, lamp: 'ready' },
    { name: 'Max', score: 9, lamp: 'wrong' },
    { name: 'Sam', score: 7, lamp: 'answered' },
];

const BUZZER_DESKS = [
    { name: 'Lina', score: 6, lamp: 'idle' },
    { name: 'Max', score: 4, lamp: 'buzz' },
    { name: 'Sam', score: 3, lamp: 'idle' },
];

// Un extrait de démonstration ne joue jamais plus longtemps que ça
const DEMO_MAX_MS = 12000;

function DeskRow({ desks }) {
    return (
        <div className="stage-floor grid grid-cols-3 gap-2" aria-hidden="true">
            {desks.map((desk) => (
                <Lectern key={desk.name} size="xs" name={desk.name} value={desk.score} lamp={desk.lamp} />
            ))}
        </div>
    );
}

// Aperçu du Blind Test : couronne qui se vide au survol, barème des extraits, égaliseur
function BlindTestPreview({ playing }) {
    return (
        <div className="flex flex-col gap-4" aria-hidden="true">
            <div className="flex items-center gap-4">
                <div className="relative h-28 w-28 shrink-0 sm:h-32 sm:w-32">
                    <div className={`bulb-ring bulb-ring-smooth absolute inset-0 ${playing ? '[--progress:18%]' : '[--progress:72%]'} group-hover:[--progress:18%] group-focus-within:[--progress:18%]`} />
                    <span className="absolute inset-0 flex items-center justify-center font-brand text-4xl">21</span>
                </div>
                <div className="flex min-w-0 flex-col gap-2">
                    <div className="flex gap-1.5">
                        {[1, 2, 3].map((level) => (
                            <span
                                key={level}
                                className={`rounded-md px-2 py-1 font-brand text-sm leading-none ${level === 2 ? 'bg-show-yellow text-show-night' : level === 1 ? 'bg-show-night/50 text-show-muted line-through' : 'bg-show-stage-2'}`}
                            >
                                {LEVEL_POINTS[level]}
                            </span>
                        ))}
                    </div>
                    <span className="inline-flex items-center gap-2 text-show-yellow">
                        <Equalizer active={playing ? true : 'hover'} className="h-6" />
                    </span>
                </div>
            </div>
            <DeskRow desks={BLINDTEST_DESKS} />
        </div>
    );
}

// Aperçu du Buzzer Battle : la photo se précise en boucle, la jauge suit
function BuzzerPreview() {
    return (
        <div className="flex flex-col gap-4" aria-hidden="true">
            <div className="relative mb-2">
                <div className="relative aspect-[16/8] overflow-hidden rounded-xl bg-show-night shadow-[0_0_0_3px_#FFFFFF]">
                    <div className="blurred-portrait portrait-sharpen absolute -inset-4" />
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-show-night/70">
                    <div className="gauge-fill h-full rounded-full bg-show-yellow" />
                </div>
                <span className="absolute -bottom-3 right-3 flex h-16 w-16 items-center justify-center rounded-full border-4 border-show-white bg-show-buzz font-brand text-sm text-show-white shadow-show-buzz transition-transform duration-200 group-hover:scale-110">
                    BUZZ
                </span>
            </div>
            <DeskRow desks={BUZZER_DESKS} />
        </div>
    );
}

// Vignette du téléphone : le jeu en un coup d'œil, sans prendre la moitié de l'écran
function Thumb({ game, playing }) {
    if (game === 'buzzer') {
        return (
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-show-night shadow-[0_0_0_2px_#FFFFFF]" aria-hidden="true">
                <div className="blurred-portrait portrait-sharpen absolute -inset-2" />
            </div>
        );
    }
    return (
        <div className="relative h-16 w-16 shrink-0" aria-hidden="true">
            <div className={`bulb-ring bulb-ring-smooth absolute inset-0 ${playing ? '[--progress:18%]' : '[--progress:72%]'}`} />
            <span className="absolute inset-0 flex items-center justify-center text-show-yellow">
                {playing ? <Equalizer active className="h-5" /> : <Icon name="headphones" size={22} />}
            </span>
        </div>
    );
}

/**
 * Extrait de démonstration du Blind Test : on écoute, puis le nom s'affiche.
 * Un seul lecteur, coupé si la carte disparaît (changement de page).
 */
function useClipDemo() {
    const [state, setState] = useState({ status: 'idle', artist: null });
    const audioRef = useRef(null);
    const timerRef = useRef(null);

    const clear = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = null;
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
            audioRef.current = null;
        }
    }, []);

    useEffect(() => clear, [clear]);

    const reveal = useCallback(() => {
        clear();
        setState((current) => (current.status === 'playing' ? { ...current, status: 'revealed' } : current));
    }, [clear]);

    const play = useCallback(async () => {
        clear();
        setState({ status: 'loading', artist: null });
        try {
            const response = await fetch(`${API_BASE_URL}/api/blindtest/demo`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const { artist, audioUrl } = await response.json();

            const audio = new Audio(`${API_BASE_URL}${audioUrl}`);
            audio.volume = 0.8;
            audio.addEventListener('ended', reveal);
            audioRef.current = audio;
            await audio.play();
            timerRef.current = setTimeout(reveal, DEMO_MAX_MS);
            setState({ status: 'playing', artist });
        } catch (error) {
            clear();
            setState({ status: 'error', artist: null });
        }
    }, [clear, reveal]);

    const stop = useCallback(() => {
        reveal();
    }, [reveal]);

    return { ...state, play, stop };
}

function DemoControls({ demo, labels }) {
    const playing = demo.status === 'playing';
    const label = playing ? labels.stop : demo.status === 'revealed' ? labels.another : labels.listen;

    return (
        <button
            type="button"
            onClick={playing ? demo.stop : demo.play}
            disabled={demo.status === 'loading'}
            aria-label={label}
            className="relative z-10 inline-flex h-11 shrink-0 items-center gap-2 rounded-full border-2 border-show-white/70 px-4 font-brand text-sm leading-none text-show-white transition hover:border-show-white hover:bg-show-white/10 disabled:cursor-wait disabled:opacity-60"
        >
            <Icon name={playing ? 'stop' : 'play'} size={16} />
            <span className="hidden min-[370px]:inline sm:hidden xl:inline">{label}</span>
        </button>
    );
}

function DemoStatus({ demo, labels }) {
    let text = '';
    if (demo.status === 'playing') text = labels.playing;
    if (demo.status === 'revealed' && demo.artist) text = labels.reveal.replace('{artist}', demo.artist);
    if (demo.status === 'error') text = labels.error;

    return (
        <p aria-live="polite" className={`px-5 text-sm font-extrabold sm:px-6 ${text ? '-mt-2 pb-5 sm:pb-6' : 'sr-only'} ${demo.status === 'revealed' ? 'text-show-yellow' : 'text-show-muted'}`}>
            {text}
        </p>
    );
}

/**
 * Carte d'un jeu sur le hub : une fenêtre ouverte sur le plateau Prime Time.
 * Toute la carte mène au jeu (lien étiré sur le bouton jaune) ; le bouton
 * d'écoute du Blind Test passe au-dessus et joue un extrait sans quitter la page.
 * Sur téléphone, l'aperçu devient une vignette : le bouton tient dans le premier écran.
 */
export default function GameCard({ game, to, kicker, name, description, players, meta, cta, demoLabels }) {
    const demo = useClipDemo();
    const withDemo = game === 'blindtest' && Boolean(demoLabels);

    return (
        <article className="group stage-light relative flex h-full flex-col overflow-hidden rounded-2xl font-show text-show-white shadow-[0_24px_48px_-24px_rgb(0_0_0/0.75)] ring-1 ring-white/20 transition duration-200 focus-within:-translate-y-1 focus-within:ring-4 focus-within:ring-brand-yellow hover:-translate-y-1 hover:shadow-[0_32px_60px_-24px_rgb(0_0_0/0.85)]">
            <div className="flex items-center gap-4 px-5 pt-5 sm:block sm:px-6 sm:pt-6">
                <div className="sm:hidden">
                    <Thumb game={game} playing={demo.status === 'playing'} />
                </div>
                <div className="min-w-0">
                    <p className="text-xs font-extrabold text-show-yellow">{kicker}</p>
                    <h2 className="mt-1 font-brand text-[1.7rem] leading-none sm:text-3xl">{name}</h2>
                </div>
            </div>

            <div className="mt-5 hidden flex-col justify-center px-6 sm:flex sm:min-h-[14rem]">
                {game === 'buzzer' ? <BuzzerPreview /> : <BlindTestPreview playing={demo.status === 'playing'} />}
            </div>

            <p className="mt-3 px-5 text-sm leading-relaxed text-show-muted sm:mt-5 sm:px-6">{description}</p>
            <p className="mt-2 px-5 text-xs font-extrabold text-show-muted sm:px-6">
                {players}
                <span aria-hidden="true"> · </span>
                {meta}
            </p>

            <div className="mt-auto flex items-center gap-3 px-5 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
                <div className="flex min-w-0 items-center gap-2">
                    <Link
                        to={to}
                        className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-show-yellow px-5 py-3 font-brand text-base leading-none text-show-night shadow-show-btn transition after:absolute after:inset-0 after:content-[''] hover:brightness-105 focus:outline-none active:translate-y-[3px] active:shadow-none"
                    >
                        {cta}
                    </Link>
                    {withDemo && <DemoControls demo={demo} labels={demoLabels} />}
                </div>
            </div>

            {withDemo && <DemoStatus demo={demo} labels={demoLabels} />}
        </article>
    );
}
