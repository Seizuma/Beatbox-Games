import React from 'react';
import { Link } from 'react-router-dom';
import PixelCharacter from './PixelCharacter';
import { PLAYER_COLORS } from './characters/pixelRig';
import { useSiteI18n } from '../../utils/siteI18n';

const TEXT = {
    fr: { badge: 'En test', title: 'Beatbox Party', text: 'Le jeu de plateau à quatre : dé, Micros d’or et mini-jeux. Version en développement, visible seulement ici.', cta: 'Jouer' },
    en: { badge: 'Testing', title: 'Beatbox Party', text: 'The four-player board game: dice, Golden Mics and minigames. Work in progress, only visible here.', cta: 'Play' },
};

// Encart de l'accueil, affiché seulement hors production
export default function PartyTeaser() {
    const { language } = useSiteI18n();
    const tx = TEXT[language] || TEXT.fr;
    return (
        <section className="mt-8 flex flex-col gap-5 rounded-2xl border border-site-line bg-[#141833] p-5 text-[#EEF1FA] sm:flex-row sm:items-center sm:p-6">
            <div className="flex shrink-0 items-end justify-center gap-1" aria-hidden="true">
                {['nova', 'grizz', 'robox', 'mimi'].map((id, i) => (
                    <PixelCharacter key={id} id={id} color={PLAYER_COLORS[i]} pose={i === 1 ? 'beatbox' : i === 3 ? 'cheer' : 'idle'} scale={1.5} />
                ))}
            </div>
            <div className="min-w-0 flex-1">
                <span className="rounded-full bg-brand-yellow px-2.5 py-0.5 text-xs font-bold text-brand-ink">{tx.badge}</span>
                <h2 className="mt-2 text-xl font-bold">{tx.title}</h2>
                <p className="mt-1 text-[0.95rem] text-[#A9B3DA]">{tx.text}</p>
            </div>
            <Link to="/beatbox-party" className="inline-flex min-h-[2.75rem] items-center justify-center rounded-lg bg-brand-yellow px-5 font-bold text-brand-ink hover:brightness-105">
                {tx.cta}
            </Link>
        </section>
    );
}
