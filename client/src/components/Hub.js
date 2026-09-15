import React from 'react';
import { Link } from 'react-router-dom';
import SEO from './SEO';
import SiteShell from './site/SiteShell';
import GameScreen from './site/GameScreen';
import JoinRoomForm from './site/JoinRoomForm';
import RankingPreview from './site/RankingPreview';
import { useSiteI18n } from '../utils/siteI18n';

const GAMES = [
    {
        id: 'blindtest',
        path: '/blindtest-online',
        nameKey: 'games.blindtest.name',
        descriptionKey: 'games.blindtest.description',
        captionKey: 'games.blindtest.screenLabel',
    },
    {
        id: 'buzzer',
        path: '/buzzer-battle',
        nameKey: 'games.buzzer.name',
        descriptionKey: 'games.buzzer.description',
    },
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

                <div className="mt-8 grid gap-10 sm:mt-10 lg:items-start lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_19rem] lg:gap-8">
                    {GAMES.map((game) => (
                        <article key={game.id} className="flex flex-col">
                            <GameScreen
                                game={game.id}
                                to={game.path}
                                name={t(game.nameKey)}
                                caption={game.captionKey ? t(game.captionKey) : undefined}
                            />
                            <h2 className="mt-4 font-brand text-xl leading-none">{t(game.nameKey)}</h2>
                            <p className="mt-2 max-w-md text-[0.95rem] leading-relaxed text-site-muted lg:min-h-[4.7rem]">
                                {t(game.descriptionKey)}
                            </p>
                            <div className="mt-4">
                                <Link
                                    to={game.path}
                                    className="inline-flex items-center rounded-lg bg-site-button px-4 py-2.5 text-sm font-bold text-site-on-button transition-colors hover:bg-site-button-hover"
                                >
                                    {t('games.create')}
                                </Link>
                            </div>
                        </article>
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