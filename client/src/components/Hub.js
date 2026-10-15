import React from 'react';
import SEO from './SEO';
import SiteShell from './site/SiteShell';
import GameCard from './site/GameCard';
import JoinRoomForm from './site/JoinRoomForm';
import RankingPreview from './site/RankingPreview';
import PublicRooms, { quickPath, usePublicRooms } from './site/PublicRooms';
import { useSiteI18n } from '../utils/siteI18n';
import PartyTeaser from './party/PartyTeaser';
import { PARTY_ENABLED } from './party/partyFlag';

const GAMES = [
    { id: 'blindtest', path: '/blindtest-online' },
    { id: 'buzzer', path: '/buzzer-battle' },
    { id: 'beatboxdle', path: '/beatboxdle' },
];

function HubContent() {
    const { t } = useSiteI18n();
    const publicRooms = usePublicRooms();
    const openRooms = (game) => publicRooms.rooms.filter((room) => room.game === game).length;

    return (
        <>
            <SEO title={t('hub.seoTitle')} description={t('hub.seoDescription')} path="/" />

            <div className="mx-auto max-w-site px-4 pb-16 pt-6 sm:px-6 sm:pt-12">
                {/* En-tête : le titre, et à droite « J'ai un code » pour qui arrive avec une invitation */}
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
                    <div className="max-w-2xl">
                        <h1 className="text-[1.6rem] font-bold leading-tight tracking-tight sm:text-4xl">
                            {t('hub.title')}
                        </h1>
                        <p className="mt-2 text-[0.95rem] leading-relaxed text-site-muted sm:mt-3 sm:text-lg">
                            {t('hub.intro')}
                        </p>
                    </div>
                    <div className="lg:w-80 lg:shrink-0">
                        <JoinRoomForm />
                    </div>
                </div>

                {/*
                    Les trois jeux côte à côte, dans la même famille de cartes : le Beatboxdle
                    n'est plus relégué dans la colonne de droite avec un autre habillage.
                */}
                <section aria-label={t('hub.gamesLabel')} className="mt-6 grid gap-6 sm:mt-10 sm:gap-8 md:grid-cols-2 lg:grid-cols-3">
                    {GAMES.map((game) => (
                        <div key={game.id} className={game.id === 'beatboxdle' ? 'md:col-span-2 lg:col-span-1' : ''}>
                            {game.id === 'beatboxdle' ? (
                                <GameCard
                                    game="beatboxdle"
                                    to={game.path}
                                    kicker={t('games.beatboxdle.kicker')}
                                    name={t('games.beatboxdle.name')}
                                    description={t('games.beatboxdle.description')}
                                    players={t('games.beatboxdle.meta')}
                                    meta={t('games.beatboxdle.reset')}
                                    cta={t('games.beatboxdle.cta')}
                                    badge={t('games.beatboxdle.badge')}
                                />
                            ) : (
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
                            )}
                        </div>
                    ))}
                </section>

                {/* Version de test uniquement : Beatbox Party, en développement */}
                {PARTY_ENABLED && <PartyTeaser />}

                {/* Sous les jeux : les salles ouvertes, puis le classement */}
                <div className="mt-10 grid gap-10 border-t border-site-line pt-8 lg:grid-cols-2 lg:gap-12">
                    {publicRooms.rooms.length > 0 && (
                        <PublicRooms rooms={publicRooms.rooms} players={publicRooms.players} t={t} />
                    )}
                    <RankingPreview />
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