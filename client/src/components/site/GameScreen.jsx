import React from 'react';
import { Link } from 'react-router-dom';

// Vignette d'un jeu vue depuis la chaîne : un écran allumé qui montre l'univers du plateau.
// Purement décorative : le lien accessible est le bouton « Créer une salle » sous la vignette.
const SCENES = {
    blindtest: { lamps: ['ready', 'idle', 'ready', 'ready'], showRing: true },
    buzzer: { lamps: ['idle', 'buzz', 'idle'], showRing: false },
};

const LAMP_CLASS = {
    idle: 'bg-show-dim',
    ready: 'bg-show-ready',
    buzz: 'bg-show-buzz',
};

export default function GameScreen({ game, to, name, caption }) {
    const scene = SCENES[game] || SCENES.blindtest;

    return (
        <Link
            to={to}
            tabIndex={-1}
            aria-hidden="true"
            className="relative block aspect-[16/9] overflow-hidden rounded-screen bg-show-stage font-show text-show-white sm:aspect-[16/10]"
        >
            {game === 'buzzer' && <div className="blurred-portrait absolute -inset-4 opacity-90" />}

            <div className="absolute inset-0 flex flex-col p-4 sm:p-5">
                <span className="font-brand text-2xl leading-none drop-shadow-sm sm:text-[1.75rem]">{name}</span>

                {scene.showRing && (
                    <div className="mt-3 flex items-center gap-3">
                        <div className="relative h-14 w-14 sm:h-16 sm:w-16">
                            <div className="bulb-ring absolute inset-0" style={{ '--progress': '70%' }} />
                            <span className="absolute inset-0 flex items-center justify-center font-brand text-lg">21</span>
                        </div>
                        {caption && <span className="max-w-[9rem] text-xs leading-snug text-show-muted">{caption}</span>}
                    </div>
                )}

                <div className="mt-auto flex gap-1.5 sm:gap-2">
                    {scene.lamps.map((lamp, index) => (
                        <div key={index} className="flex flex-1 flex-col items-center">
                            <span className={`h-1.5 w-3 rounded-t ${LAMP_CLASS[lamp]}`} />
                            <span className="block h-2.5 w-full rounded-t bg-show-white" />
                            <span className="lectern-base block h-4 w-full bg-show-desk sm:h-5" />
                        </div>
                    ))}
                </div>
            </div>
        </Link>
    );
}