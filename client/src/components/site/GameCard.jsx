import React from 'react';
import { Link } from 'react-router-dom';
import Lectern from '../show/Lectern';
import { Equalizer } from '../show/GameHud';
import { LEVEL_POINTS } from '../../utils/showI18n';

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
function BlindTestPreview() {
    return (
        <div className="flex flex-col gap-4" aria-hidden="true">
            <div className="flex items-center gap-4">
                <div className="relative h-28 w-28 shrink-0 sm:h-32 sm:w-32">
                    <div className="bulb-ring bulb-ring-smooth absolute inset-0 [--progress:72%] group-hover:[--progress:18%] group-focus-visible:[--progress:18%]" />
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
                        <Equalizer active="hover" className="h-6" />
                    </span>
                </div>
            </div>
            <DeskRow desks={BLINDTEST_DESKS} />
        </div>
    );
}

// Aperçu du Buzzer Battle : photo qui se précise au survol, jauge de netteté, buzzer
function BuzzerPreview() {
    return (
        <div className="flex flex-col gap-4" aria-hidden="true">
            <div className="relative mb-2">
                <div className="relative aspect-[16/8] overflow-hidden rounded-xl bg-show-night shadow-[0_0_0_3px_#FFFFFF]">
                    <div className="blurred-portrait absolute -inset-4 transition-[filter] duration-700 group-hover:[filter:blur(1.5px)] group-focus-visible:[filter:blur(1.5px)]" />
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-show-night/70">
                    <div className="h-full w-[38%] rounded-full bg-show-yellow transition-[width] duration-700 group-hover:w-[86%] group-focus-visible:w-[86%]" />
                </div>
                <span className="absolute -bottom-3 right-3 flex h-16 w-16 items-center justify-center rounded-full border-4 border-show-white bg-show-buzz font-brand text-sm text-show-white shadow-show-buzz transition-transform duration-200 group-hover:scale-110">
                    BUZZ
                </span>
            </div>
            <DeskRow desks={BUZZER_DESKS} />
        </div>
    );
}

/**
 * Carte d'un jeu sur le hub : une fenêtre ouverte sur le plateau Prime Time.
 * Toute la carte est cliquable ; le bouton jaune n'est qu'un repère visuel.
 */
export default function GameCard({ game, to, kicker, name, description, players, meta, cta }) {
    return (
        <Link
            to={to}
            className="group stage-light relative flex h-full flex-col overflow-hidden rounded-2xl font-show text-show-white shadow-[0_24px_48px_-24px_rgb(0_0_0/0.75)] ring-1 ring-white/10 transition duration-200 hover:-translate-y-1 hover:shadow-[0_32px_60px_-24px_rgb(0_0_0/0.85)] focus-visible:-translate-y-1 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow"
        >
            <div className="px-5 pt-5 sm:px-6 sm:pt-6">
                <p className="text-xs font-extrabold text-show-yellow">{kicker}</p>
                <h2 className="mt-1 font-brand text-3xl leading-none">{name}</h2>
            </div>

            <div className="mt-5 flex flex-col justify-end px-5 sm:min-h-[15.5rem] sm:px-6">
                {game === 'buzzer' ? <BuzzerPreview /> : <BlindTestPreview />}
            </div>

            <p className="mt-5 px-5 text-sm leading-relaxed text-show-muted sm:px-6">{description}</p>

            <div className="mt-auto flex items-center justify-between gap-3 px-5 pb-5 pt-5 sm:px-6 sm:pb-6">
                <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-show-yellow px-5 py-3 font-brand text-base leading-none text-show-night shadow-show-btn transition group-hover:brightness-105 group-active:translate-y-[3px] group-active:shadow-none">
                    {cta}
                </span>
                <span className="flex min-w-0 flex-col items-end text-right text-[11px] font-extrabold leading-snug text-show-muted sm:text-xs">
                    <span>{players}</span>
                    <span>{meta}</span>
                </span>
            </div>
        </Link>
    );
}