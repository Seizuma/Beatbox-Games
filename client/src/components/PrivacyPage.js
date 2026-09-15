import React from 'react';
import SEO from './SEO';
import SiteShell from './site/SiteShell';
import { PageContainer } from './site/SiteUI';
import LegalLayout, { LegalList, LegalSection, MailLink } from './legal/LegalLayout';
import Icon from './icons/Icon';
import { useI18n } from '../utils/i18n';
import { useSiteI18n } from '../utils/siteI18n';
import { stripEmoji } from '../utils/showI18n';

// Le texte juridique reste dans i18n.js ; il est remonté à chaque changement de langue du site
function PrivacyDocument() {
    const { t: rawT, isEnglish } = useI18n();
    const t = (key, variables) => stripEmoji(rawT(key, variables));

    const sections = [
        { id: 'privacy-intro', title: t('privacyIntroTitle') },
        { id: 'privacy-data', title: t('privacyDataCollectedTitle') },
        { id: 'privacy-usage', title: t('privacyDataUsageTitle') },
        { id: 'privacy-storage', title: t('privacyStorageTitle') },
        { id: 'privacy-cookies', title: t('privacyCookiesTitle') },
        { id: 'privacy-sharing', title: t('privacySharingTitle') },
        { id: 'privacy-rights', title: t('privacyRightsTitle') },
        { id: 'privacy-third-party', title: t('privacyThirdPartyTitle') },
        { id: 'privacy-updates', title: t('privacyUpdatesTitle') },
        { id: 'privacy-contact', title: t('privacyContactTitle') },
    ];

    const updated = t('privacyLastUpdate', {
        date: new Date().toLocaleDateString(isEnglish ? 'en-US' : 'fr-FR'),
    });

    return (
        <>
            <SEO title={`${t('privacyPageTitle')} — BeatBox Games`} description={t('privacyIntroText')} url="https://beatboxgames.com/#/privacy" />
            <LegalLayout title={t('privacyPageTitle')} updated={updated} sections={sections}>
                <div className="rounded-xl border border-site-line bg-site-surface p-5">
                    <h2 className="text-base font-bold">{t('privacyBriefTitle')}</h2>
                    <ul className="mt-3 flex flex-col gap-2 text-sm text-site-muted">
                        {['privacyBrief1', 'privacyBrief2', 'privacyBrief3', 'privacyBrief4'].map((key) => (
                            <li key={key} className="flex items-start gap-2">
                                <Icon name="check" size={16} className="mt-0.5 text-site-success" />
                                <span>{t(key)}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <LegalSection id="privacy-intro" title={sections[0].title}>
                    <p>{t('privacyIntroText')}</p>
                </LegalSection>

                <LegalSection id="privacy-data" title={sections[1].title}>
                    <h3 className="font-bold text-site-ink">{t('privacyAnonymousMode')}</h3>
                    <p>{t('privacyAnonymousText')}</p>
                    <h3 className="mt-2 font-bold text-site-ink">{t('privacyDiscordMode')}</h3>
                    <p>{t('privacyDiscordIntro')}</p>
                    <LegalList
                        items={[
                            t('privacyDataDiscordId'),
                            t('privacyDataUsername'),
                            t('privacyDataAvatar'),
                            <>
                                {t('privacyDataStats')}
                                <ul className="mt-1.5 flex list-[circle] flex-col gap-1 pl-5">
                                    <li>{t('privacyDataGamesPlayed')}</li>
                                    <li>{t('privacyDataScores')}</li>
                                    <li>{t('privacyDataWins')}</li>
                                    <li>{t('privacyDataDates')}</li>
                                    <li>{t('privacyDataHistory')}</li>
                                </ul>
                            </>,
                        ]}
                    />
                </LegalSection>

                <LegalSection id="privacy-usage" title={sections[2].title}>
                    <p>{t('privacyDataUsageIntro')}</p>
                    <LegalList
                        items={[
                            t('privacyDataUsageAuth'),
                            t('privacyDataUsageScores'),
                            t('privacyDataUsageLeaderboard'),
                            t('privacyDataUsageComm'),
                        ]}
                    />
                    <p><strong>{t('privacyNoAds')}</strong></p>
                </LegalSection>

                <LegalSection id="privacy-storage" title={sections[3].title}>
                    <p><strong>{t('privacyStorageLocation')}</strong> {t('privacyStorageLocationText')}</p>
                    <p><strong>{t('privacyStorageSecurity')}</strong> {t('privacySecurityText')}</p>
                    <p><strong>{t('privacyStorageRetention')}</strong> {t('privacyRetentionText')}</p>
                </LegalSection>

                <LegalSection id="privacy-cookies" title={sections[4].title}>
                    <p>{t('privacyCookiesIntro')}</p>
                    <LegalList items={[t('privacyCookiesLocalStorage'), t('privacyCookiesSessionStorage')]} />
                    <p><strong>{t('privacyCookiesNoTracking')}</strong></p>
                </LegalSection>

                <LegalSection id="privacy-sharing" title={sections[5].title}>
                    <p><strong>{t('privacySharingNoShare')}</strong></p>
                    <p>{t('privacySharingInternal')}</p>
                    <p>{t('privacySharingPublic')}</p>
                </LegalSection>

                <LegalSection id="privacy-rights" title={sections[6].title}>
                    <p>{t('privacyRightsIntro')}</p>
                    <LegalList
                        items={[
                            t('privacyRightsAccess'),
                            t('privacyRightsRectification'),
                            t('privacyRightsErasure'),
                            t('privacyRightsObjection'),
                            t('privacyRightsPortability'),
                        ]}
                    />
                    <p className="rounded-lg bg-site-tint px-4 py-3 text-site-ink">{t('privacyRightsExercise')}</p>
                </LegalSection>

                <LegalSection id="privacy-third-party" title={sections[7].title}>
                    <p>
                        {t('privacyThirdPartyText')}{' '}
                        <a
                            href="https://discord.com/privacy"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-site-ink underline decoration-brand-yellow decoration-2 underline-offset-4"
                        >
                            {isEnglish ? 'Discord’s Privacy Policy' : t('privacyThirdPartyLink')}
                            <Icon name="external" size={13} />
                        </a>.
                    </p>
                </LegalSection>

                <LegalSection id="privacy-updates" title={sections[8].title}>
                    <p>{t('privacyUpdatesText')}</p>
                </LegalSection>

                <LegalSection id="privacy-contact" title={sections[9].title}>
                    <p>{t('privacyContactIntro')}</p>
                    <p><MailLink /></p>
                    <p className="text-sm">{t('privacyContactResponse')}</p>
                </LegalSection>
            </LegalLayout>
        </>
    );
}

function PrivacyContent() {
    const { language } = useSiteI18n();
    return (
        <PageContainer>
            <PrivacyDocument key={language} />
        </PageContainer>
    );
}

function PrivacyPage() {
    return (
        <SiteShell>
            <PrivacyContent />
        </SiteShell>
    );
}

export default PrivacyPage;