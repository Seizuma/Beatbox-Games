import React from 'react';
import { Link } from 'react-router-dom';
import SEO from './SEO';
import SiteShell from './site/SiteShell';
import { PageContainer } from './site/SiteUI';
import LegalLayout, { LegalSection, MailLink } from './legal/LegalLayout';
import { useI18n } from '../utils/i18n';
import { useSiteI18n } from '../utils/siteI18n';
import { stripEmoji } from '../utils/showI18n';

// Le texte juridique reste dans i18n.js ; il est remonté à chaque changement de langue du site
function LegalDocument() {
    const { t: rawT } = useI18n();
    const t = (key) => stripEmoji(rawT(key));

    const sections = [
        { id: 'legal-about', title: t('legalIntroTitle') },
        { id: 'legal-publisher', title: t('legalPublisherTitle') },
        { id: 'legal-audio', title: t('legalAudioContentTitle') },
        { id: 'legal-ip', title: t('legalIntellectualPropertyTitle') },
        { id: 'legal-contact', title: t('legalContactTitle') },
    ];

    return (
        <>
            <SEO title={`${t('legalPageTitle')} — BeatBox Games`} description={t('legalIntroText')} url="https://beatboxgames.com/#/legal" />
            <LegalLayout title={t('legalPageTitle')} sections={sections}>
                <LegalSection id="legal-about" title={sections[0].title}>
                    <p>{t('legalIntroText')}</p>
                </LegalSection>

                <LegalSection id="legal-publisher" title={sections[1].title}>
                    <p>{t('legalPublisherInfo')}</p>
                    <p><MailLink /></p>
                </LegalSection>

                <LegalSection id="legal-audio" title={sections[2].title}>
                    <p>
                        {t('legalAudioContentText')}{' '}
                        <Link to="/credits" className="font-semibold text-site-ink underline decoration-brand-yellow decoration-2 underline-offset-4">
                            {t('legalAudioContentCredits')}
                        </Link>.
                    </p>
                    <p>{t('legalAudioContentNonProfit')}</p>
                </LegalSection>

                <LegalSection id="legal-ip" title={sections[3].title}>
                    <p>{t('legalIntellectualPropertyText')}</p>
                </LegalSection>

                <LegalSection id="legal-contact" title={sections[4].title}>
                    <p>{t('legalContactIntro')}</p>
                    <p><MailLink /></p>
                </LegalSection>
            </LegalLayout>
        </>
    );
}

function LegalContent() {
    const { language } = useSiteI18n();
    return (
        <PageContainer>
            <LegalDocument key={language} />
        </PageContainer>
    );
}

function LegalPage() {
    return (
        <SiteShell>
            <LegalContent />
        </SiteShell>
    );
}

export default LegalPage;