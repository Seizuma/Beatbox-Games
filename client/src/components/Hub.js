import React from 'react';
import SEO from './SEO';
import SiteShell from './site/SiteShell';
import GameCard from './site/GameCard';
import DailyCard from './site/DailyCard';
import JoinRoomForm from './site/JoinRoomForm';
import RankingPreview from './site/RankingPreview';
import { useSiteI18n } from '../utils/siteI18n';

const GAMES = [
    { id: 'blindtest', path: '/blindtest-online' },
    { id: 'buzzer', path: '/buzzer-battle' },
];

function HubContent() {
    const { t } = useSiteI18n();

    return (
        <>
            <SEO title={t('hub.seoTitle')} description={t('hub.seoDescription')} url="https://beatboxgames.com" />

            <div className="mx-auto max-w-site px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
                <div className="max-w-2xl">
                    <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight sm:text-4xl">
                        {t('hub.title')}
                    </h1>
                    <p className="mt-3 text-base leading-relaxed text-site-muted sm:text-lg">
                        {t('hub.intro')}
                    </p>
                </div>

                {/*
                    Mobile : pile ordonnée « J'ai un code », les deux jeux, le classement.
                    Quelqu'un qui arrive avec un lien ou un code voit d'abord ce qui le concerne.
                    Grand écran : les jeux occupent les deux premières colonnes, la colonne de
                    droite regroupe le code et le classement (display:contents libère l'ordre).
                */}
                <div className="mt-8 flex flex-col gap-8 sm:mt-10 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_19rem] lg:gap-8">
                    <aside className="contents lg:col-start-3 lg:row-start-1 lg:flex lg:flex-col lg:gap-10 lg:border-l lg:border-site-line lg:pl-8">
                        <div className="order-1 lg:order-none">
                            <JoinRoomForm />
                        </div>
                        <div className="order-4 lg:order-none">
                            <DailyCard
                                kicker={t('games.beatboxdle.kicker')}
                                name={t('games.beatboxdle.name')}
                                description={t('games.beatboxdle.description')}
                                meta={t('games.beatboxdle.meta')}
                                cta={t('games.beatboxdle.cta')}
                            />
                        </div>
                        <div className="order-5 border-t border-site-line pt-8 lg:order-none lg:border-t-0 lg:pt-0">
                            <RankingPreview />
                        </div>
                    </aside>

                    {GAMES.map((game, index) => (
                        <div key={game.id} className={index === 0 ? 'order-2 lg:order-none' : 'order-3 lg:order-none'}>
                            <GameCard
                                game={game.id}
                                to={game.path}
                                kicker={t(`games.${game.id}.kicker`)}
                                name={t(`games.${game.id}.name`)}
                                description={t(`games.${game.id}.description`)}
                                players={t('games.players')}
                                meta={t(`games.${game.id}.meta`)}
                                cta={t('games.create')}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}

function Hub() {
    return (
        <SiteShell>
            <HubContent />
        </SiteShell>
    );
}

export default Hub;