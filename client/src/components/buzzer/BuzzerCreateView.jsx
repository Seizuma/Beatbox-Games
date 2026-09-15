import React, { useEffect, useId, useState } from 'react';
import GameShell from '../show/GameShell';
import ShowButton from '../show/ShowButton';
import BuzzerRulesModal from './BuzzerRulesModal';
import { getRandomPseudo } from '../../utils/randomPseudo';
import { createShowT } from '../../utils/showI18n';

const CODE_MAX_LENGTH = 6;

const MODES = {
    COUNTRY: 'buzzer_country',
    EVENT: 'buzzer_event'
};

// Configuration par défaut à la création, modifiable ensuite dans la salle d'attente
const DEFAULT_CONFIG = {
    mode: MODES.EVENT,
    filter: 'Grand Beatbox Battle',
    totalRounds: 10
};

// Entrée sur le plateau du Buzzer Battle : nom du joueur, création de salle ou code d'invitation
function BuzzerCreateView({
    onCreateRoom,
    onJoinRoom,
    username,
    setUsername,
    avatar,
    discordUser = null,
    language,
    languageSwitch,
    onQuit
}) {
    const st = createShowT(language);
    const nameId = useId();
    const codeId = useId();
    const codeHelpId = useId();

    const [joinRoomCode, setJoinRoomCode] = useState('');
    const [showRules, setShowRules] = useState(false);

    useEffect(() => {
        if (discordUser?.username) {
            setUsername(discordUser.username);
        } else if (!username || username.trim() === '') {
            setUsername(getRandomPseudo());
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [discordUser]);

    const cleanName = (username || '').trim();
    const cleanCode = joinRoomCode.trim().toUpperCase();
    const canCreate = cleanName.length > 0;
    const canJoin = canCreate && cleanCode.length > 0;

    const submitCreate = (event) => {
        event.preventDefault();
        if (!canCreate) return;
        onCreateRoom({ ...DEFAULT_CONFIG, username: cleanName, avatar });
    };

    const submitJoin = (event) => {
        event.preventDefault();
        if (!canJoin) return;
        onJoinRoom({ roomCode: cleanCode, username: cleanName, avatar });
    };

    const discordAvatarUrl = discordUser?.discordId && discordUser?.avatar
        ? `https://cdn.discordapp.com/avatars/${discordUser.discordId}/${discordUser.avatar}.png?size=64`
        : null;

    return (
        <GameShell title={st('buzzer.name')} onQuit={onQuit} quitLabel={st('common.quit')} tools={languageSwitch}>
            <div className="mx-auto flex max-w-md flex-col gap-6">
                <div className="text-center">
                    <h1 className="font-brand text-4xl leading-none sm:text-5xl">{st('buzzer.name')}</h1>
                    <p className="mt-3 text-show-muted">{st('buzzer.tagline')}</p>
                </div>

                <form onSubmit={submitCreate} className="flex flex-col gap-3">
                    <div className="rounded-xl bg-show-yellow px-4 pb-3 pt-2.5 text-show-night focus-within:ring-4 focus-within:ring-show-white/70">
                        <div className="flex items-center justify-between gap-3">
                            <label htmlFor={nameId} className="text-xs font-extrabold">{st('create.nameLabel')}</label>
                            {!discordUser && (
                                <button
                                    type="button"
                                    onClick={() => setUsername(getRandomPseudo())}
                                    className="text-xs font-extrabold underline decoration-2 underline-offset-2 hover:no-underline"
                                >
                                    {st('buzzerCreate.random')}
                                </button>
                            )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-3">
                            {discordAvatarUrl && (
                                <img src={discordAvatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full bg-show-night/10" />
                            )}
                            <input
                                id={nameId}
                                type="text"
                                value={username}
                                onChange={(event) => setUsername(event.target.value)}
                                maxLength={20}
                                disabled={Boolean(discordUser)}
                                autoComplete="nickname"
                                placeholder={st('create.namePlaceholder')}
                                className="block w-full min-w-0 bg-transparent font-brand text-2xl leading-tight placeholder:text-show-night/40 focus:outline-none disabled:cursor-not-allowed"
                            />
                        </div>
                        {discordUser && <p className="mt-1 text-xs font-semibold">{st('buzzerCreate.discordLocked')}</p>}
                    </div>
                    <ShowButton type="submit" size="lg" block disabled={!canCreate}>
                        {st('create.create')}
                    </ShowButton>
                </form>

                <div className="flex items-center gap-3 text-sm text-show-muted" aria-hidden="true">
                    <span className="h-px flex-1 bg-show-desk" />
                    {st('create.or')}
                    <span className="h-px flex-1 bg-show-desk" />
                </div>

                <form onSubmit={submitJoin}>
                    <label htmlFor={codeId} className="mb-2 block text-sm font-extrabold">{st('create.codeLabel')}</label>
                    <div className="flex gap-2">
                        <input
                            id={codeId}
                            type="text"
                            value={joinRoomCode}
                            onChange={(event) => setJoinRoomCode(event.target.value.toUpperCase().slice(0, CODE_MAX_LENGTH))}
                            maxLength={CODE_MAX_LENGTH}
                            autoComplete="off"
                            autoCapitalize="characters"
                            spellCheck="false"
                            placeholder={st('create.codePlaceholder')}
                            aria-describedby={codeHelpId}
                            className="min-w-0 flex-1 rounded-full bg-show-white px-5 py-3 text-lg font-extrabold uppercase tracking-[0.2em] text-show-night placeholder:font-semibold placeholder:tracking-[0.12em] placeholder:text-slate-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-show-yellow"
                        />
                        <ShowButton type="submit" variant="white" size="lg" disabled={!canJoin}>
                            {st('create.join')}
                        </ShowButton>
                    </div>
                    <p id={codeHelpId} className="mt-2 text-xs text-show-muted">{st('buzzerCreate.codeHelp')}</p>
                </form>

                <button
                    type="button"
                    onClick={() => setShowRules(true)}
                    className="self-center text-sm font-semibold text-show-muted underline decoration-show-yellow decoration-2 underline-offset-4 hover:text-show-white"
                >
                    {st('common.howToPlay')}
                </button>
            </div>

            <BuzzerRulesModal open={showRules} onClose={() => setShowRules(false)} st={st} />
        </GameShell>
    );
}

export default BuzzerCreateView;