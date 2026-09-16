import React, { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSiteI18n } from '../../utils/siteI18n';
import { API_BASE_URL } from '../../utils/useApi';

const CODE_PATTERN = /^[A-Z0-9]{4,8}$/;

const GAME_PATHS = {
    blindtest: '/blindtest-online',
    buzzer: '/buzzer-battle',
};

/**
 * Un code = une salle.
 * Le serveur reconnaît le jeu à partir du code, l'invité n'a donc plus à le choisir :
 * une saisie, un bouton, et la redirection se fait toute seule.
 */
export default function JoinRoomForm() {
    const { t } = useSiteI18n();
    const navigate = useNavigate();
    const baseId = useId();

    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [checking, setChecking] = useState(false);

    const codeId = `${baseId}-code`;
    const helpId = `${baseId}-help`;

    const handleSubmit = async (event) => {
        event.preventDefault();
        const cleanCode = code.trim().toUpperCase();

        if (!CODE_PATTERN.test(cleanCode)) {
            setError(t('join.invalid'));
            return;
        }

        setChecking(true);
        setError('');

        try {
            const response = await fetch(`${API_BASE_URL}/api/rooms/${encodeURIComponent(cleanCode)}`);

            if (response.status === 404) {
                setError(t('join.notFound'));
                return;
            }
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            const path = GAME_PATHS[data.game];

            if (!path) {
                setError(t('join.notFound'));
                return;
            }

            navigate(`${path}?room=${encodeURIComponent(cleanCode)}`);
        } catch (requestError) {
            setError(t('join.failed'));
        } finally {
            setChecking(false);
        }
    };

    const helpText = error || (checking ? t('join.checking') : t('join.help'));

    return (
        <section aria-labelledby={`${baseId}-title`}>
            <h2 id={`${baseId}-title`} className="text-base font-bold">{t('join.title')}</h2>

            <form onSubmit={handleSubmit} noValidate className="mt-3">
                <label htmlFor={codeId} className="sr-only">{t('join.code')}</label>
                <div className={`flex overflow-hidden rounded-lg border bg-site-surface focus-within:outline focus-within:outline-2 focus-within:outline-site-ink ${error ? 'border-site-danger' : 'border-site-line'}`}>
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
                    <button
                        type="submit"
                        disabled={checking}
                        className="bg-site-button px-4 text-sm font-bold text-site-on-button transition-colors hover:bg-site-button-hover disabled:cursor-wait disabled:opacity-70"
                    >
                        {t('join.submit')}
                    </button>
                </div>
                <p id={helpId} aria-live="polite" className={`mt-1.5 text-xs ${error ? 'font-semibold text-site-danger' : 'text-site-soft'}`}>
                    {helpText}
                </p>
            </form>
        </section>
    );
}