import React from 'react';
import ShowModal from '../show/ShowModal';
import ShowButton from '../show/ShowButton';

const STEPS = ['rules.step1', 'rules.step2', 'rules.step3', 'rules.step4', 'rules.step5', 'rules.step6'];

// Règles du Blind Test, ouvertes depuis l'entrée sur le plateau et la salle d'attente
export default function BlindTestRulesModal({ open, onClose, st }) {
    return (
        <ShowModal
            open={open}
            onClose={onClose}
            title={st('rules.title')}
            closeLabel={st('common.close')}
            footer={<ShowButton block size="lg" onClick={onClose}>{st('common.understood')}</ShowButton>}
        >
            <ol className="flex flex-col gap-3">
                {STEPS.map((key, index) => (
                    <li key={key} className="flex gap-3 text-[0.95rem] leading-relaxed">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-show-yellow font-brand text-sm text-show-night">
                            {index + 1}
                        </span>
                        <span className="pt-0.5">{st(key)}</span>
                    </li>
                ))}
            </ol>
        </ShowModal>
    );
}