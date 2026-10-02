import React, { useEffect, useId, useMemo, useState } from 'react';
import ShowModal from '../show/ShowModal';
import ShowButton from '../show/ShowButton';
import { getPickerLabels, NamePicker, RangeField, SettingsTabPanel, SettingsTabs } from '../show/SettingsParts';
import Icon from '../icons/Icon';

export const BUZZER_MODES = {
    COUNTRY: 'buzzer_country',
    EVENT: 'buzzer_event'
};

// Nombre minimum de beatboxers cochés, qui est aussi le nombre minimum de manches
export const MIN_BUZZER_POOL = 5;

export const poolKey = (mode, filter) => `${mode}|${filter}`;

const EMPTY_POOL = { status: 'loading', names: [] };

/**
 * Réglages du Buzzer Battle pour l'hôte, en trois onglets :
 * Partie (mode, pays ou événement, manches), Beatboxers (sélection par nom, jamais de photo), Joueurs.
 * pools : listes de noms déjà chargées par clé mode|filtre, requestPool pour en demander une.
 */
export default function BuzzerSettingsModal({
    open,
    onClose,
    st,
    config,
    countries,
    events,
    loadingFilters,
    pools,
    requestPool,
    kickablePlayers,
    onKick,
    onSave
}) {
    const idBase = useId();
    const filterId = useId();
    const roundsId = useId();

    const [tab, setTab] = useState('game');
    const [mode, setMode] = useState(config.mode);
    const [filter, setFilter] = useState(config.filter);
    const [rounds, setRounds] = useState(config.totalRounds);
    const [excluded, setExcluded] = useState(() => new Set());
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');

    // Chaque ouverture repart de la configuration en vigueur dans la salle
    useEffect(() => {
        if (!open) return;
        setTab('game');
        setMode(config.mode);
        setFilter(config.filter);
        setRounds(config.totalRounds);
        setExcluded(new Set(config.excluded || []));
        setSaving(false);
        setSaveError('');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    useEffect(() => {
        if (open && mode && filter) requestPool(mode, filter);
    }, [open, mode, filter, requestPool]);

    const filterOptions = mode === BUZZER_MODES.COUNTRY ? countries : events;
    const pool = (filter && pools[poolKey(mode, filter)]) || EMPTY_POOL;
    const poolReady = pool.status === 'ready';
    const total = pool.names.length;
    const selectedCount = useMemo(
        () => pool.names.filter((name) => !excluded.has(name)).length,
        [pool.names, excluded]
    );
    const minSelected = Math.min(MIN_BUZZER_POOL, total || MIN_BUZZER_POOL);
    const tooFew = poolReady && total > 0 && selectedCount < minSelected;

    // Pas plus de manches que de beatboxers cochés
    const roundsMax = Math.max(1, poolReady ? selectedCount : rounds);
    const roundsMin = Math.min(MIN_BUZZER_POOL, roundsMax);
    const roundsValue = Math.max(roundsMin, Math.min(roundsMax, rounds));

    const changeMode = (nextMode) => {
        if (nextMode === mode) return;
        const options = nextMode === BUZZER_MODES.COUNTRY ? countries : events;
        setMode(nextMode);
        setFilter(options[0] || '');
    };

    const handleSave = async () => {
        setSaving(true);
        setSaveError('');
        try {
            await onSave({
                mode,
                filter,
                totalRounds: roundsValue,
                excludedBeatboxers: Array.from(excluded)
            });
            onClose();
        } catch (error) {
            setSaveError(error?.message || st('settings.saveError'));
        } finally {
            setSaving(false);
        }
    };

    const tabs = [
        { id: 'game', label: st('settings.tabGame') },
        { id: 'beatboxers', label: st('buzzerSettings.tabBeatboxers'), badge: poolReady && total ? `${selectedCount}/${total}` : null, alert: tooFew },
        { id: 'players', label: st('settings.tabPlayers'), badge: kickablePlayers.length ? String(kickablePlayers.length) : null },
    ];

    return (
        <ShowModal
            open={open}
            onClose={onClose}
            title={st('buzzerSettings.title')}
            closeLabel={st('common.close')}
            size="lg"
            toolbar={<SettingsTabs idBase={idBase} tabs={tabs} active={tab} onChange={setTab} label={st('settings.tabsLabel')} />}
            footer={
                <div className="flex flex-col gap-2">
                    {saveError && <p role="alert" className="text-center text-xs font-semibold text-show-yellow">{saveError}</p>}
                    <div className="flex gap-2">
                        <ShowButton variant="outline" size="md" block onClick={onClose}>
                            {st('common.cancel')}
                        </ShowButton>
                        <ShowButton size="md" block onClick={handleSave} disabled={saving || !filter || !poolReady || tooFew}>
                            {saving ? st('settings.saving') : st('buzzerSettings.save')}
                        </ShowButton>
                    </div>
                </div>
            }
        >
            <SettingsTabPanel idBase={idBase} id="game" active={tab}>
                <fieldset>
                    <legend className="mb-2 text-sm font-extrabold">{st('buzzerSettings.mode')}</legend>
                    <div className="grid grid-cols-2 gap-1 rounded-full bg-show-night p-1">
                        {[
                            { id: BUZZER_MODES.COUNTRY, key: 'buzzerSettings.modeCountry' },
                            { id: BUZZER_MODES.EVENT, key: 'buzzerSettings.modeEvent' },
                        ].map((option) => {
                            const active = mode === option.id;
                            return (
                                <label
                                    key={option.id}
                                    className={`cursor-pointer rounded-full px-3 py-2 text-center text-sm font-extrabold transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-show-yellow ${active ? 'bg-show-yellow text-show-night' : 'text-show-muted hover:text-show-white'}`}
                                >
                                    <input
                                        type="radio"
                                        name={`${idBase}-mode`}
                                        value={option.id}
                                        checked={active}
                                        onChange={() => changeMode(option.id)}
                                        className="sr-only"
                                    />
                                    {st(option.key)}
                                </label>
                            );
                        })}
                    </div>
                </fieldset>

                <div>
                    <label htmlFor={filterId} className="mb-2 block text-sm font-extrabold">
                        {st(mode === BUZZER_MODES.COUNTRY ? 'buzzerSettings.filterCountry' : 'buzzerSettings.filterEvent')}
                    </label>
                    <div className="relative">
                        <select
                            id={filterId}
                            value={filter || ''}
                            onChange={(event) => setFilter(event.target.value)}
                            disabled={loadingFilters || filterOptions.length === 0}
                            className="w-full appearance-none rounded-full bg-show-white py-3 pl-4 pr-10 text-base font-semibold text-show-night focus:outline-none focus-visible:ring-4 focus-visible:ring-show-yellow disabled:opacity-60"
                        >
                            {loadingFilters && <option value="">{st('buzzerSettings.loadingFilters')}</option>}
                            {!loadingFilters && !filter && <option value="" disabled>—</option>}
                            {filterOptions.map((option) => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </select>
                        <Icon name="chevron-down" size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-show-night" />
                    </div>
                </div>

                <RangeField
                    id={roundsId}
                    label={st('buzzerSettings.rounds')}
                    value={roundsValue}
                    min={roundsMin}
                    max={roundsMax}
                    onChange={setRounds}
                    help={poolReady ? st('buzzerSettings.roundsHelp', { min: roundsMin, max: roundsMax }) : st('picker.loading')}
                    decreaseLabel={`${st('settings.decrease')} : ${st('buzzerSettings.rounds')}`}
                    increaseLabel={`${st('settings.increase')} : ${st('buzzerSettings.rounds')}`}
                    disabled={!poolReady || roundsMin === roundsMax}
                />

                <button
                    type="button"
                    onClick={() => setTab('beatboxers')}
                    className="flex items-center justify-between gap-3 rounded-xl bg-show-night/50 px-4 py-3 text-left ring-1 ring-white/5 transition-colors hover:bg-show-night/70"
                >
                    <span>
                        <span className="block text-sm font-extrabold">{st('buzzerSettings.tabBeatboxers')}</span>
                        <span className="block text-xs text-show-muted">
                            {poolReady ? st('picker.selected', { count: selectedCount, total }) : st('picker.loading')}
                        </span>
                    </span>
                    <Icon name="chevron-right" size={18} className="text-show-muted" />
                </button>
            </SettingsTabPanel>

            <SettingsTabPanel idBase={idBase} id="beatboxers" active={tab}>
                <NamePicker
                    names={pool.names}
                    excluded={excluded}
                    onChange={setExcluded}
                    status={pool.status}
                    minSelected={minSelected}
                    help={(
                        <>
                            {st('buzzerSettings.beatboxersHelp')}
                            <span className="mt-1 block text-xs">{st('buzzerSettings.beatboxersKept')}</span>
                        </>
                    )}
                    labels={getPickerLabels(st)}
                />
            </SettingsTabPanel>

            <SettingsTabPanel idBase={idBase} id="players" active={tab}>
                <div>
                    {kickablePlayers.length === 0 ? (
                        <p className="text-sm text-show-muted">{st('settings.noOthers')}</p>
                    ) : (
                        <ul className="flex flex-col divide-y divide-show-desk">
                            {kickablePlayers.map((player) => (
                                <li key={player.id} className="flex items-center gap-2 py-2.5">
                                    <span className={`min-w-0 flex-1 truncate font-semibold ${player.connected === false ? 'text-show-muted' : ''}`}>
                                        {player.username}
                                    </span>
                                    <ShowButton
                                        variant="buzz"
                                        size="sm"
                                        aria-label={st('settings.kickLabel', { name: player.username })}
                                        onClick={() => onKick(player)}
                                    >
                                        <Icon name="close" size={14} />
                                        <span className="hidden sm:inline">{st('settings.kick')}</span>
                                    </ShowButton>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </SettingsTabPanel>
        </ShowModal>
    );
}
