import React, { useEffect, useId, useMemo, useState } from 'react';
import ShowModal from '../show/ShowModal';
import ShowButton from '../show/ShowButton';
import { getPickerLabels, NamePicker, RangeField, SettingsTabPanel, SettingsTabs } from '../show/SettingsParts';
import Icon from '../icons/Icon';
import { useBlindTestArtists } from '../../hooks/useBlindTestArtists';

/**
 * Réglages de la salle du Blind Test pour l'hôte, en trois onglets :
 * Partie (manches, temps), Artistes (sélection), Joueurs (hôte, exclusion).
 * Les réglages de partie et la sélection sont un brouillon envoyé d'un coup avec Enregistrer.
 */
export default function BlindTestSettingsModal({
    open,
    onClose,
    st,
    artistCount,
    answerTime,
    artistCountRange,
    answerTimeSettings,
    artistPool,
    otherPlayers,
    onSave,
    onTransferHost,
    onKickPlayer
}) {
    const idBase = useId();
    const countId = useId();
    const timeId = useId();
    const { artists: names, status: namesStatus } = useBlindTestArtists();

    const [tab, setTab] = useState('game');
    const [draftCount, setDraftCount] = useState(artistCount);
    const [draftTime, setDraftTime] = useState(answerTime);
    const [draftExcluded, setDraftExcluded] = useState(() => new Set());
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');

    // Chaque ouverture repart des réglages en vigueur dans la salle
    useEffect(() => {
        if (!open) return;
        setTab('game');
        setDraftCount(artistCount);
        setDraftTime(answerTime);
        setDraftExcluded(new Set(artistPool?.excluded || []));
        setSaving(false);
        setSaveError('');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const total = names.length || artistPool?.total || 0;
    const selectedCount = useMemo(
        () => (names.length ? names.filter((name) => !draftExcluded.has(name)).length : total - draftExcluded.size),
        [names, draftExcluded, total]
    );
    const minSelected = artistPool?.minSelected ?? 5;
    const tooFew = total > 0 && selectedCount < Math.min(minSelected, total);

    // Plage de manches recalculée selon la sélection en cours
    const modeMin = artistCountRange?.modeMin ?? artistCountRange?.min ?? 10;
    const modeMax = artistCountRange?.modeMax ?? null;
    const countMax = Math.max(1, Math.min(modeMax || selectedCount, selectedCount));
    const countMin = Math.min(modeMin, countMax);
    const countValue = Math.max(countMin, Math.min(countMax, draftCount));

    const timeMin = answerTimeSettings?.min || 5;
    const timeMax = answerTimeSettings?.max || 60;

    const handleSave = async () => {
        setSaving(true);
        setSaveError('');
        try {
            await onSave({
                artistCount: countValue,
                answerTime: draftTime,
                excludedArtists: Array.from(draftExcluded)
            });
            onClose();
        } catch (error) {
            setSaveError(error?.fromServer ? error.message : st('settings.saveError'));
        } finally {
            setSaving(false);
        }
    };

    const tabs = [
        { id: 'game', label: st('settings.tabGame') },
        { id: 'artists', label: st('settings.tabArtists'), badge: total ? `${selectedCount}/${total}` : null, alert: tooFew },
        { id: 'players', label: st('settings.tabPlayers'), badge: otherPlayers.length ? String(otherPlayers.length) : null },
    ];

    return (
        <ShowModal
            open={open}
            onClose={onClose}
            title={st('settings.title')}
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
                        <ShowButton size="md" block onClick={handleSave} disabled={saving || tooFew}>
                            {saving ? st('settings.saving') : st('settings.save')}
                        </ShowButton>
                    </div>
                </div>
            }
        >
            <SettingsTabPanel idBase={idBase} id="game" active={tab}>
                <RangeField
                    id={countId}
                    label={st('settings.artistCount')}
                    value={countValue}
                    min={countMin}
                    max={countMax}
                    onChange={setDraftCount}
                    help={st('settings.artistHelp', { min: countMin, max: countMax })}
                    decreaseLabel={`${st('settings.decrease')} : ${st('settings.artistCount')}`}
                    increaseLabel={`${st('settings.increase')} : ${st('settings.artistCount')}`}
                    disabled={countMin === countMax}
                />
                <RangeField
                    id={timeId}
                    label={st('settings.answerTime')}
                    value={draftTime}
                    display={`${draftTime} s`}
                    min={timeMin}
                    max={timeMax}
                    onChange={setDraftTime}
                    help={st('settings.answerHelp', { min: timeMin, max: timeMax })}
                    decreaseLabel={`${st('settings.decrease')} : ${st('settings.answerTime')}`}
                    increaseLabel={`${st('settings.increase')} : ${st('settings.answerTime')}`}
                />
                <button
                    type="button"
                    onClick={() => setTab('artists')}
                    className="flex items-center justify-between gap-3 rounded-xl bg-show-night/50 px-4 py-3 text-left ring-1 ring-white/5 transition-colors hover:bg-show-night/70"
                >
                    <span>
                        <span className="block text-sm font-extrabold">{st('settings.tabArtists')}</span>
                        <span className="block text-xs text-show-muted">{st('picker.selected', { count: selectedCount, total })}</span>
                    </span>
                    <Icon name="chevron-right" size={18} className="text-show-muted" />
                </button>
            </SettingsTabPanel>

            <SettingsTabPanel idBase={idBase} id="artists" active={tab}>
                <NamePicker
                    names={names}
                    excluded={draftExcluded}
                    onChange={setDraftExcluded}
                    status={namesStatus}
                    minSelected={Math.min(minSelected, total || minSelected)}
                    help={st('settings.artistsHelp')}
                    labels={getPickerLabels(st)}
                />
            </SettingsTabPanel>

            <SettingsTabPanel idBase={idBase} id="players" active={tab}>
                <div>
                    <p className="text-xs text-show-muted">{st('settings.playersHelp')}</p>
                    {otherPlayers.length === 0 ? (
                        <p className="mt-3 text-sm text-show-muted">{st('settings.noOthers')}</p>
                    ) : (
                        <ul className="mt-2 flex flex-col divide-y divide-show-desk">
                            {otherPlayers.map((player) => (
                                <li key={player.pseudo} className="flex items-center gap-2 py-2.5">
                                    <span className={`min-w-0 flex-1 truncate font-semibold ${player.connected ? '' : 'text-show-muted'}`}>
                                        {player.pseudo}
                                    </span>
                                    <ShowButton
                                        variant="white"
                                        size="sm"
                                        aria-label={st('settings.makeHostLabel', { name: player.pseudo })}
                                        onClick={() => onTransferHost(player.pseudo)}
                                    >
                                        <Icon name="crown" size={14} />
                                        <span className="hidden sm:inline">{st('settings.makeHost')}</span>
                                    </ShowButton>
                                    <ShowButton
                                        variant="buzz"
                                        size="sm"
                                        aria-label={st('settings.kickLabel', { name: player.pseudo })}
                                        onClick={() => onKickPlayer(player.pseudo)}
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
