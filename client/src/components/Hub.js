import React from 'react';
import SEO from './SEO';
import SiteShell from './site/SiteShell';
import GameCard from './site/GameCard';
import DailyCard from './site/DailyCard';
import JoinRoomForm from './site/JoinRoomForm';
import RankingPreview from './site/RankingPreview';
import PublicRooms, { quickPath, usePublicRooms } from './site/PublicRooms';
import { useSiteI18n } from '../utils/siteI18n';

const GAMES = [
    { id: 'blindtest', path: '/blindtest-online' },
    { id: 'buzzer', path: '/buzzer-battle' },
];

function HubContent() {
    const { t } = useSiteI18n();
    const publicRooms = usePublicRooms();
    const openRooms = (game) => publicRooms.rooms.filter((room) => room.game === game).length;

    return (
        <>
            <SEO title={t('hub.seoTitle')} description={t('hub.seoDescription')} url="https://beatboxgames.com" />

            <div className="mx-auto max-w-site px-4 pb-16 pt-6 sm:px-6 sm:pt-12">
                <div className="max-w-2xl">
                    <h1 className="text-[1.6rem] font-bold leading-tight tracking-tight sm:text-4xl">
                        {t('hub.title')}
                    </h1>
                    <p className="mt-2 text-[0.95rem] leading-relaxed text-site-muted sm:mt-3 sm:text-lg">
                        {t('hub.intro')}
                    </p>
                </div>

                {/*
                    Mobile : pile ordonnée « J'ai un code », les deux jeux, le classement.
                    Quelqu'un qui arrive avec un lien ou un code voit d'abord ce qui le concerne.
                    Grand écran : les jeux occupent les deux premières colonnes, la colonne de
                    droite regroupe le code et le classement (display:contents libère l'ordre).
                */}
                {/*
                    La colonne de droite s'étend sur deux rangées, la seconde en 1fr : la hauteur
                    des cartes ne dépend plus que de leur contenu, et leurs boutons restent dans
                    le premier écran au lieu d'être poussés en bas par le classement.
                */}
                <div className="mt-6 flex flex-col gap-6 sm:mt-10 sm:gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_19rem] lg:grid-rows-[auto_1fr] lg:gap-8">
                    <aside className="contents lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:flex lg:flex-col lg:gap-10 lg:border-l lg:border-site-line lg:pl-8">
                        <div className="order-1 lg:order-none">
                            <JoinRoomForm />
                        </div>
                        {publicRooms.rooms.length > 0 && (
                            <div className="order-4 lg:order-none">
                                <PublicRooms rooms={publicRooms.rooms} players={publicRooms.players} t={t} />
                            </div>
                        )}
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
                        <div key={game.id} className={index === 0 ? 'order-2 lg:order-none lg:row-start-1' : 'order-3 lg:order-none lg:row-start-1'}>
                            <GameCard
                                game={game.id}
                                to={game.path}
                                kicker={t(`games.${game.id}.kicker`)}
                                name={t(`games.${game.id}.name`)}
                                description={t(`games.${game.id}.description`)}
                                players={t('games.players')}
                                meta={t(`games.${game.id}.meta`)}
                                cta={t('games.create')}
                                quick={{
                                    to: quickPath(game.id),
                                    label: t('games.quick'),
                                    detail: openRooms(game.id) ? t('games.quickOpen', { count: openRooms(game.id) }) : null,
                                }}
                                demoLabels={game.id === 'blindtest' ? {
                                    listen: t('games.demo.listen'),
                                    another: t('games.demo.another'),
                                    stop: t('games.demo.stop'),
                                    playing: t('games.demo.playing'),
                                    reveal: t('games.demo.reveal'),
                                    error: t('games.demo.error'),
                                } : undefined}
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