import React, { useCallback, useEffect, useRef, useState } from 'react';
import { sfx } from '../partySfx';
import SoundPads from './SoundPads';
import { SOUNDS, useFrame, usePadKeys, usePressKeys } from './shared';

// Entraînement sur l'écran des règles (13-B) : la commande du mini-jeu, pour de faux, pendant
// que les autres se préparent. Rien n'est envoyé au serveur.

const CONTROL = {
    degaine: 'reaction',
    gorgee: 'hold',
    bottle2: 'hold',
    micdrop: 'timing',
    cale: 'rhythm',
    loop2: 'rhythm',
    roulement: 'mash',
    tug: 'mash',
    echo: 'pads',
    crowd: 'pads',
    vibe: 'pads',
    ledrop: 'tracks',
};

// Bouton d'entraînement : appui (pointeur ou Espace) et relâchement
function PracticeButton({ label, onDown, onUp, tone = 'gold' }) {
    usePressKeys({ onDown, onUp });
    return (
        <button
            type="button"
            className={`party-practice-btn is-${tone}`}
            onPointerDown={(event) => { event.preventDefault(); if (onDown) onDown(); }}
            onPointerUp={() => onUp && onUp()}
            onPointerLeave={() => onUp && onUp()}
        >
            {label}
        </button>
    );
}

function Result({ children, good }) {
    return <p className={`party-practice-result ${good ? 'is-good' : ''}`} aria-live="polite">{children || ' '}</p>;
}

// Pads de son : chaque pad joue son son
function PadsPractice({ t }) {
    const [lit, setLit] = useState(null);
    const timer = useRef(null);
    const onPad = useCallback((i) => {
        sfx(SOUNDS[i].id);
        setLit(i);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setLit(null), 180);
    }, []);
    useEffect(() => () => clearTimeout(timer.current), []);
    usePadKeys(onPad);
    return (
        <>
            <SoundPads compact onPad={onPad} lit={lit} />
            <Result>{t('practice.pads')}</Result>
        </>
    );
}

// Frappes rapides : cadence sur les deux dernières secondes
function MashPractice({ t }) {
    const taps = useRef([]);
    const [rate, setRate] = useState(0);
    const [best, setBest] = useState(0);
    const tap = () => {
        const now = performance.now();
        taps.current = [...taps.current.filter((x) => now - x < 2000), now];
        sfx('snare');
    };
    useEffect(() => {
        const timer = setInterval(() => {
            const now = performance.now();
            taps.current = taps.current.filter((x) => now - x < 2000);
            const r = Math.round((taps.current.length / 2) * 10) / 10;
            setRate(r);
            setBest((b) => Math.max(b, r));
        }, 200);
        return () => clearInterval(timer);
    }, []);
    return (
        <>
            <PracticeButton label={t('practice.tap')} onDown={tap} />
            <Result good={rate >= 6}>{`${t('practice.rate', { n: rate })} · ${t('practice.best', { n: best })}`}</Result>
        </>
    );
}

// Maintenir puis relâcher près du trait
const FILL_MS = 2000;
const METER_MAX = 1.15;

function HoldPractice({ t }) {
    const start = useRef(null);
    const fillRef = useRef(null);
    const last = useRef(0);
    const [result, setResult] = useState(null);
    const down = () => {
        if (start.current != null) return;
        start.current = performance.now();
        setResult(null);
    };
    const up = () => {
        if (start.current == null) return;
        const level = (performance.now() - start.current) / FILL_MS;
        start.current = null;
        last.current = level;
        if (level > 1) { setResult({ text: t('practice.overflow'), good: false }); sfx('fail'); }
        else {
            const pct = Math.round(level * 100);
            setResult({ text: pct >= 92 ? `${t('practice.perfect')} ${pct} %` : t('practice.level', { n: pct }), good: pct >= 92 });
            sfx(pct >= 92 ? 'star' : 'coin');
        }
    };
    useFrame(() => {
        const level = start.current != null ? (performance.now() - start.current) / FILL_MS : last.current;
        if (start.current != null && level > METER_MAX) up();
        if (fillRef.current) fillRef.current.style.width = `${Math.min(1, level / METER_MAX) * 100}%`;
    });
    return (
        <>
            <div className="party-practice-meter" aria-hidden="true">
                <span ref={fillRef} className="party-practice-fill" />
                <span className="party-practice-line" style={{ left: `${(1 / METER_MAX) * 100}%` }} />
            </div>
            <PracticeButton label={t('practice.hold')} onDown={down} onUp={up} />
            <Result good={result && result.good}>{result && result.text}</Result>
        </>
    );
}

// Réflexe : attendre le signal puis appuyer
function ReactionPractice({ t }) {
    const [phase, setPhase] = useState('idle');
    const [result, setResult] = useState(null);
    const goAt = useRef(0);
    const timer = useRef(null);
    useEffect(() => () => clearTimeout(timer.current), []);
    const press = () => {
        if (phase === 'wait') {
            clearTimeout(timer.current);
            setPhase('idle');
            setResult({ text: t('practice.falseStart'), good: false });
            sfx('fail');
        } else if (phase === 'go') {
            const ms = Math.round(performance.now() - goAt.current);
            setPhase('idle');
            setResult({ text: t('practice.ms', { n: ms }), good: ms < 350 });
            sfx('hit');
        } else {
            setResult(null);
            setPhase('wait');
            timer.current = setTimeout(() => {
                goAt.current = performance.now();
                setPhase('go');
                sfx('drop');
            }, 1000 + Math.random() * 1800);
        }
    };
    const label = { idle: t('practice.start'), wait: t('practice.wait'), go: t('practice.go') }[phase];
    return (
        <>
            <PracticeButton label={label} onDown={press} tone={phase === 'go' ? 'green' : phase === 'wait' ? 'red' : 'gold'} />
            <Result good={result && result.good}>{result && result.text}</Result>
        </>
    );
}

// Lâcher au bon moment : un curseur se balance au-dessus de la cible
const SWING_MS = 1700;
const TARGET = [0.62, 0.74];

function TimingPractice({ t }) {
    const startAt = useRef(performance.now());
    const stopped = useRef(null);
    const cursorRef = useRef(null);
    const [result, setResult] = useState(null);
    const posAt = (now) => 0.5 - 0.5 * Math.cos(((now - startAt.current) / SWING_MS) * Math.PI * 2);
    const press = () => {
        if (stopped.current != null) {
            stopped.current = null;
            startAt.current = performance.now();
            setResult(null);
            return;
        }
        const pos = posAt(performance.now());
        stopped.current = pos;
        const miss = pos < TARGET[0] ? TARGET[0] - pos : pos > TARGET[1] ? pos - TARGET[1] : 0;
        if (miss === 0) { setResult({ text: t('practice.hit'), good: true }); sfx('star'); }
        else if (miss < 0.08) { setResult({ text: t('practice.close'), good: false }); sfx('coin'); }
        else { setResult({ text: t('practice.miss'), good: false }); sfx('fail'); }
    };
    useFrame(() => {
        const pos = stopped.current != null ? stopped.current : posAt(performance.now());
        if (cursorRef.current) cursorRef.current.style.left = `${pos * 100}%`;
    });
    return (
        <>
            <div className="party-practice-meter" aria-hidden="true">
                <span className="party-practice-zone" style={{ left: `${TARGET[0] * 100}%`, width: `${(TARGET[1] - TARGET[0]) * 100}%` }} />
                <span ref={cursorRef} className="party-practice-cursor" />
            </div>
            <PracticeButton label={result ? t('practice.again') : t('practice.drop')} onDown={press} />
            <Result good={result && result.good}>{result && result.text}</Result>
        </>
    );
}

// Rythme : un métronome à 100 BPM, frapper sur les temps
const BEAT_MS = 600;

function RhythmPractice({ t }) {
    const startAt = useRef(performance.now());
    const [beat, setBeat] = useState(0);
    const [result, setResult] = useState(null);
    const lastBeat = useRef(-1);
    // Le métronome ne sonne qu'après une frappe, et se tait après 6 temps sans frappe
    const lastPress = useRef(-100);
    useFrame(() => {
        const n = Math.floor((performance.now() - startAt.current) / BEAT_MS);
        if (n !== lastBeat.current) {
            lastBeat.current = n;
            setBeat(n % 4);
            if (n - lastPress.current <= 6) sfx(n % 4 === 0 ? 'kick' : 'tick');
        }
    });
    const press = () => {
        lastPress.current = lastBeat.current;
        const elapsed = performance.now() - startAt.current;
        const nearest = Math.round(elapsed / BEAT_MS) * BEAT_MS;
        const offset = Math.round(elapsed - nearest);
        sfx('snare');
        if (Math.abs(offset) <= 45) setResult({ text: t('practice.onBeat'), good: true });
        else setResult({ text: offset < 0 ? t('practice.early', { n: -offset }) : t('practice.late', { n: offset }), good: false });
    };
    return (
        <>
            <div className="party-practice-beats" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => <span key={i} className={i === beat ? 'is-on' : ''} />)}
            </div>
            <PracticeButton label={t('practice.hitBeat')} onDown={press} />
            <Result good={result && result.good}>{result && result.text}</Result>
        </>
    );
}

// Le Drop : se placer sur une piste, deux pistes tombent
function TracksPractice({ t }) {
    const [mine, setMine] = useState(null);
    const [dropped, setDropped] = useState([]);
    const timer = useRef(null);
    useEffect(() => () => clearTimeout(timer.current), []);
    const pick = (i) => {
        if (mine != null && !dropped.length) return;
        setMine(i);
        setDropped([]);
        sfx('tick');
        timer.current = setTimeout(() => {
            const order = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5).slice(0, 2);
            setDropped(order);
            sfx(order.includes(i) ? 'fail' : 'star');
        }, 900);
    };
    const out = mine != null && dropped.includes(mine);
    let text = t('practice.pick');
    if (mine != null && dropped.length) text = out ? t('practice.out') : t('practice.survived');
    return (
        <>
            <div className="grid grid-cols-5 gap-1.5">
                {[0, 1, 2, 3, 4].map((i) => (
                    <button
                        key={i}
                        type="button"
                        className={`party-track !min-h-[3.4rem] ${mine === i ? 'is-chosen' : ''} ${dropped.includes(i) ? 'is-dropped' : ''}`}
                        onClick={() => pick(i)}
                        aria-pressed={mine === i}
                    >
                        <span className="party-track-num !text-lg">{i + 1}</span>
                    </button>
                ))}
            </div>
            <Result good={mine != null && dropped.length > 0 && !out}>{text}</Result>
        </>
    );
}

const WIDGETS = { pads: PadsPractice, mash: MashPractice, hold: HoldPractice, reaction: ReactionPractice, timing: TimingPractice, rhythm: RhythmPractice, tracks: TracksPractice };

export default function Practice({ id, t }) {
    const Widget = WIDGETS[CONTROL[id]];
    if (!Widget) return null;
    return (
        <div className="party-practice">
            <Widget t={t} />
        </div>
    );
}
