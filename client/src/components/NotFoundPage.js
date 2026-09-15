import React from 'react';
import SEO from './SEO';
import SiteShell from './site/SiteShell';
import { PageContainer, SiteButton } from './site/SiteUI';
import BulbRing from './show/BulbRing';
import { useSiteI18n } from '../utils/siteI18n';

function NotFoundContent() {
    const { t } = useSiteI18n();

    return (
        <>
            <SEO title={t('notFound.seoTitle')} description={t('notFound.text')} />
            <PageContainer>
                <div className="mx-auto flex max-w-lg flex-col items-center py-10 text-center">
                    <BulbRing progress={0} size={132}>
                        <span className="font-brand text-3xl leading-none text-site-ink">404</span>
                    </BulbRing>
                    <h1 className="mt-8 text-[1.75rem] font-bold leading-tight tracking-tight sm:text-4xl">{t('notFound.title')}</h1>
                    <p className="mt-3 text-site-muted">{t('notFound.text')}</p>
                    <div className="mt-8 flex flex-wrap justify-center gap-3">
                        <SiteButton to="/">{t('notFound.home')}</SiteButton>
                        <SiteButton to="/stats" variant="secondary">{t('notFound.rankings')}</SiteButton>
                    </div>
                </div>
            </PageContainer>
        </>
    );
}

function NotFoundPage() {
    return (
        <SiteShell>
            <NotFoundContent />
        </SiteShell>
    );
}

export default NotFoundPage;