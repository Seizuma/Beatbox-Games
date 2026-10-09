import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ShowButton from './ShowButton';
import Icon from '../icons/Icon';
import { API_BASE_URL } from '../../utils/useApi';

/**
 * Partie rapide : rejoindre la salle publique en attente la plus remplie, ou
 * en ouvrir une si aucune n'attend. C'est ce qui permet de jouer sans avoir
 * d'amis connectés au même moment.
 *
 * `auto` : lancé tout seul une fois (lien « Partie rapide » de l'accueil),
 * dès que le bouton est utilisable.
 */
export function QuickPlayButton({ game, label, searchingLabel, hint, disabled = false, auto = false, onJoin, onCreatePublic }) {
    const [searching, setSearching] = useState(false);
    const autoDone = useRef(false);
    const location = useLocation();
    const navigate = useNavigate();

    const run = async () => {
        if (searching || disabled) return;
        setSearching(true);
        let code = null;
        try {
            const response = await fetch(`${API_BASE_URL}/api/rooms/quick?game=${game}`);
            const payload = response.ok ? await response.json() : null;
            code = payload && payload.code ? payload.code : null;
        } catch (error) {
            code = null;
        }
        setSearching(false);
        if (code) onJoin(code);
        else onCreatePublic();
    };

    useEffect(() => {
        if (!auto || disabled || autoDone.current) return;
        autoDone.current = true;
        // Le paramètre « quick » ne sert qu'une fois : au retour sur cet écran, plus de départ automatique
        navigate(location.pathname, { replace: true });
        run();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [auto, disabled]);

    return (
        <div className="flex flex-col gap-1.5">
            <ShowButton variant="white" size="lg" block onClick={run} disabled={disabled || searching}>
                <Icon name="zap" size={18} />
                {searching ? searchingLabel : label}
            </ShowButton>
            {hint && <p className="text-center text-xs text-show-muted">{hint}</p>}
        </div>
    );
}

/** Secondes restantes jusqu'à `at` (millisecondes), rafraîchies à la seconde. */
function useSecondsLeft(at) {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        if (!at) return undefined;
        setNow(Date.now());
        const timer = setInterval(() => setNow(Date.now()), 500);
        return () => clearInterval(timer);
    }, [at]);
    return at ? Math.max(0, Math.ceil((at - now) / 1000)) : null;
}

/**
 * Bandeau de salle publique dans la salle d'attente : compte à rebours du
 * démarrage automatique, ou attente du deuxième joueur.
 */
export function PublicRoomBanner({ isPublic, autoStartAt, st }) {
    const seconds = useSecondsLeft(autoStartAt);
    if (!isPublic) return null;

    return (
        <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-xl bg-show-stage-2 px-4 py-3 ring-1 ring-show-yellow/40">
            <span className="shrink-0 rounded-full bg-show-yellow px-2.5 py-1 text-[11px] font-extrabold text-show-night">
                {st('public.badge')}
            </span>
            <span className="min-w-0 text-sm font-semibold">
                {seconds !== null
                    ? st('public.startsIn', { seconds })
                    : st('public.waiting')}
            </span>
        </div>
    );
}
