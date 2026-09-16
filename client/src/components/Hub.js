import React from 'react';
import SEO from './SEO';
import SiteShell from './site/SiteShell';
import GameCard from './site/GameCard';
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

                <div className="mt-8 grid gap-6 sm:mt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_19rem] lg:gap-8">
                    {GAMES.map((game) => (
                        <GameCard
                            key={game.id}
                            game={game.id}
                            to={game.path}
                            kicker={t(`games.${game.id}.kicker`)}
                            name={t(`games.${game.id}.name`)}
                            description={t(`games.${game.id}.description`)}
                            players={t('games.players')}
                            meta={t(`games.${game.id}.meta`)}
                            cta={t('games.create')}
                        />
                    ))}

                    <aside className="flex flex-col gap-10 border-t border-site-line pt-8 lg:gap-8 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                        <JoinRoomForm />
                        <RankingPreview />
                    </aside>
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