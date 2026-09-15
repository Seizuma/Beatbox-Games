import React, { useId, useState } from 'react';
import GameShell from '../show/GameShell';
import ShowButton from '../show/ShowButton';
import BlindTestRulesModal from './BlindTestRulesModal';
import { createShowT } from '../../utils/showI18n';

const CODE_LENGTH = 5;

// Entrée sur le plateau : nom du joueur, création de salle ou code d'invitation
const CreateView = ({
    pseudo,
    setPseudo,
    handleCreateRoom,
    handleJoinRoom,
    LanguageSwitch,
    GameModeBadge,
    language,
    suggestedRoom,
    isFromSharedLink,
    onBackToHub
}) => {
    const st = createShowT(language);
    const nameId = useId();
    const codeId = useId();
    const codeHelpId = useId();

    const [joinRoomCode, setJoinRoomCode] = useState(() =>
        String(suggestedRoom || '').toUpperCase().slice(0, CODE_LENGTH)
    );
    const [showRules, setShowRules] = useState(false);

    const hasName = Boolean(pseudo && pseudo.trim());
    const cleanCode = joinRoomCode.trim().toUpperCase();
    const canJoin = hasName && cleanCode.length === CODE_LENGTH;

    const submitCreate = (event) => {
        event.preventDefault();
        if (hasName) handleCreateRoom();
    };

    const submitJoin = (event) => {
        event.preventDefault();
        if (canJoin) handleJoinRoom(cleanCode);
    };

    return (
        <GameShell
            title={st('blindtest.name')}
            onQuit={onBackToHub}
            quitLabel={st('common.quit')}
            tools={LanguageSwitch ? <LanguageSwitch /> : null}
        >
            <div className="mx-auto flex max-w-md flex-col gap-6">
                <div className="text-center">
                    <h1 className="font-brand text-4xl leading-none sm:text-5xl">{st('blindtest.name')}</h1>
                    <p className="mt-3 text-show-muted">{st('blindtest.tagline')}</p>
                    {GameModeBadge && (
                        <div className="mt-3 flex justify-center">
                            <GameModeBadge />
                        </div>
                    )}
                </div>

                {isFromSharedLink && suggestedRoom && (
                    <p className="rounded-xl bg-show-stage-2 px-4 py-3 text-center text-sm font-semibold">
                        {st('create.invited', { room: String(suggestedRoom).toUpperCase() })}
                    </p>
                )}

                <form onSubmit={submitCreate} className="flex flex-col gap-3">
                    <label
                        htmlFor={nameId}
                        className="block rounded-xl bg-show-yellow px-4 pb-3 pt-2.5 text-show-night focus-within:ring-4 focus-within:ring-show-white/70"
                    >
                        <span className="text-xs font-extrabold">{st('create.nameLabel')}</span>
                        <input
                            id={nameId}
                            type="text"
                            value={pseudo}
                            onChange={(event) => setPseudo(event.target.value)}
                            maxLength={20}
                            autoComplete="nickname"
                            placeholder={st('create.namePlaceholder')}
                            className="mt-0.5 block w-full bg-transparent font-brand text-2xl leading-tight placeholder:text-show-night/40 focus:outline-none"
                        />
                    </label>
                    <ShowButton type="submit" size="lg" block disabled={!hasName}>
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
                            onChange={(event) => setJoinRoomCode(event.target.value.toUpperCase().slice(0, CODE_LENGTH))}
                            maxLength={CODE_LENGTH}
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
                    <p id={codeHelpId} className="mt-2 text-xs text-show-muted">{st('create.codeHelp')}</p>
                </form>

                <button
                    type="button"
                    onClick={() => setShowRules(true)}
                    className="self-center text-sm font-semibold text-show-muted underline decoration-show-yellow decoration-2 underline-offset-4 hover:text-show-white"
                >
                    {st('common.howToPlay')}
                </button>
            </div>

            <BlindTestRulesModal open={showRules} onClose={() => setShowRules(false)} st={st} />
        </GameShell>
    );
};

export default CreateView;