import React from 'react';
import GameShell from '../show/GameShell';
import BulbRing from '../show/BulbRing';
import Icon from '../icons/Icon';
import { createShowT } from '../../utils/showI18n';

// Connexion au serveur ou entrée dans une salle
const LoadingView = ({ room, LanguageSwitch, GameModeBadge, language }) => {
    const st = createShowT(language);

    return (
        <GameShell title={st('blindtest.name')} tools={LanguageSwitch ? <LanguageSwitch /> : null}>
            <div role="status" aria-live="polite" className="flex min-h-[60dvh] flex-col items-center justify-center gap-6 text-center">
                <BulbRing size={140} ringClassName="motion-safe:animate-[spin_8s_linear_infinite]">
                    <Icon name="headphones" size={40} className="text-show-yellow" />
                </BulbRing>
                <div>
                    <p className="font-brand text-2xl leading-tight">{st('loading.connecting')}</p>
                    {room && <p className="mt-2 text-show-muted">{st('loading.joining', { room })}</p>}
                    {GameModeBadge && (
                        <div className="mt-4 flex justify-center">
                            <GameModeBadge />
                        </div>
                    )}
                </div>
            </div>
        </GameShell>
    );
};

export default LoadingView;