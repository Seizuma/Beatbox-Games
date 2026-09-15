import React, { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSiteI18n } from '../../utils/siteI18n';

const JOINABLE_GAMES = [
    { id: 'blindtest', path: '/blindtest-online', nameKey: 'games.blindtest.name' },
    { id: 'buzzer', path: '/buzzer-battle', nameKey: 'games.buzzer.name' },
];

const CODE_PATTERN = /^[A-Z0-9]{4,8}$/;

export default function JoinRoomForm() {
    const { t } = useSiteI18n();
    const navigate = useNavigate();
    const baseId = useId();

    const [gameId, setGameId] = useState(JOINABLE_GAMES[0].id);
    const [code, setCode] = useState('');
    const [error, setError] = useState('');

    const codeId = `${baseId}-code`;
    const helpId = `${baseId}-help`;

    const handleSubmit = (event) => {
        event.preventDefault();
        const cleanCode = code.trim().toUpperCase();

        if (!CODE_PATTERN.test(cleanCode)) {
            setError(t('join.invalid'));
            return;
        }

        const game = JOINABLE_GAMES.find((item) => item.id === gameId) || JOINABLE_GAMES[0];
        navigate(`${game.path}?room=${encodeURIComponent(cleanCode)}`);
    };

    return (
        <section aria-labelledby={`${baseId}-title`}>
            <h2 id={`${baseId}-title`} className="text-base font-bold">{t('join.title')}</h2>

            <form onSubmit={handleSubmit} noValidate className="mt-3 flex flex-col gap-3">
                <fieldset>
                    <legend className="sr-only">{t('join.game')}</legend>
                    <div className="flex gap-1 rounded-lg bg-site-tint p-1 text-sm font-bold">
                        {JOINABLE_GAMES.map((game) => {
                            const checked = gameId === game.id;
                            return (
                                <label
                                    key={game.id}
                                    className={`flex-1 cursor-pointer whitespace-nowrap rounded-md px-2 py-1.5 text-center transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-site-ink ${checked
                                        ? 'bg-site-surface text-site-ink shadow-[0_1px_0_theme(colors.site.line)]'
                                        : 'text-site-muted hover:text-site-ink'
                                        }`}
                                >
                                    <input
                                        type="radio"
                                        name={`${baseId}-game`}
                                        value={game.id}
                                        checked={checked}
                                        onChange={() => setGameId(game.id)}
                                        className="sr-only"
                                    />
                                    {t(game.nameKey)}
                                </label>
                            );
                        })}
                    </div>
                </fieldset>

                <div>
                    <label htmlFor={codeId} className="sr-only">{t('join.code')}</label>
                    <div className={`flex overflow-hidden rounded-lg border bg-site-surface focus-within:outline focus-within:outline-2 focus-within:outline-site-ink ${error ? 'border-brand-live' : 'border-site-line'}`}>
                        <input
                            id={codeId}
                            type="text"
                            inputMode="text"
                            autoComplete="off"
                            autoCapitalize="characters"
                            spellCheck="false"
                            maxLength={8}
                            value={code}
                            placeholder={t('join.placeholder')}
                            aria-invalid={Boolean(error)}
                            aria-describedby={helpId}
                            onChange={(event) => {
                                setCode(event.target.value.toUpperCase());
                                if (error) setError('');
                            }}
                            className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-base font-semibold uppercase tracking-[0.12em] text-site-ink placeholder:font-normal placeholder:text-site-soft focus:outline-none"
                        />
                        <button type="submit" className="bg-site-ink px-4 text-sm font-bold text-white transition-colors hover:bg-[#1C2C5C]">
                            {t('join.submit')}
                        </button>
                    </div>
                    <p id={helpId} aria-live="polite" className={`mt-1.5 text-xs ${error ? 'font-semibold text-brand-live' : 'text-site-soft'}`}>
                        {error || t('join.help')}
                    </p>
                </div>
            </form>
        </section>
    );
}