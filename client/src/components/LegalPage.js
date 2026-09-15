import React from 'react';
import { useI18n } from '../utils/i18n';
import SEO from './SEO';

function LegalPage() {
    const { t, switchLanguage, isEnglish } = useI18n();

    const handleGoBack = () => {
        window.location.href = '/#/';
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
            <SEO title={t('legalPageTitle')} description={t('legalIntroText')} />

            {/* Language Switch */}
            <div className="absolute top-4 right-4 z-20">
                <div className="flex items-center gap-2 bg-zinc-800/90 backdrop-blur-sm border border-zinc-700/50 rounded-full p-1">
                    <button
                        onClick={() => switchLanguage('fr')}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-all duration-200 ${!isEnglish
                            ? 'bg-cyan-500 text-white shadow-lg'
                            : 'text-zinc-300 hover:text-white hover:bg-zinc-700/50'
                            }`}
                    >
                        🇫🇷 FR
                    </button>
                    <button
                        onClick={() => switchLanguage('en')}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-all duration-200 ${isEnglish
                            ? 'bg-cyan-500 text-white shadow-lg'
                            : 'text-zinc-300 hover:text-white hover:bg-zinc-700/50'
                            }`}
                    >
                        🇺🇸 EN
                    </button>
                </div>
            </div>

            <div className="container mx-auto px-4 py-8 max-w-4xl">
                <button
                    onClick={handleGoBack}
                    className="mb-6 flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    {t('backToHome')}
                </button>

                <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-8">
                    <h1 className="text-4xl font-bold text-cyan-400 mb-6">⚖️ {t('legalPageTitle')}</h1>

                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-white mb-4">{t('legalIntroTitle')}</h2>
                        <p className="text-zinc-300 leading-relaxed">{t('legalIntroText')}</p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-white mb-4">{t('legalPublisherTitle')}</h2>
                        <p className="text-zinc-300 mb-3">{t('legalPublisherInfo')}</p>
                        <div className="bg-zinc-900/50 rounded-lg p-4">
                            <a
                                href="mailto:contact@beatboxgames.com"
                                className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors"
                            >
                                📮 contact@beatboxgames.com
                            </a>
                        </div>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-white mb-4">{t('legalAudioContentTitle')}</h2>
                        <p className="text-zinc-300 mb-3">
                            {t('legalAudioContentText')}{' '}
                            <a href="/#/credits" className="text-cyan-400 hover:text-cyan-300 underline">
                                {t('legalAudioContentCredits')}
                            </a>.
                        </p>
                        <p className="text-zinc-400 text-sm">{t('legalAudioContentNonProfit')}</p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-white mb-4">{t('legalIntellectualPropertyTitle')}</h2>
                        <p className="text-zinc-300">{t('legalIntellectualPropertyText')}</p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">{t('legalContactTitle')}</h2>
                        <p className="text-zinc-300 mb-3">{t('legalContactIntro')}</p>
                        <div className="bg-zinc-900/50 rounded-lg p-4">
                            <a
                                href="mailto:contact@beatboxgames.com"
                                className="text-cyan-400 hover:text-cyan-300 font-semibold text-lg transition-colors"
                            >
                                📮 contact@beatboxgames.com
                            </a>
                        </div>
                    </section>
                </div>

                <div className="mt-8 text-center text-zinc-400 text-sm">
                    <p>
                        <a href="/#/privacy" className="hover:text-cyan-400 transition-colors">
                            {t('legalFooterPrivacyLink')}
                        </a>
                        {' • '}
                        <a href="/#/credits" className="hover:text-cyan-400 transition-colors">
                            {t('legalFooterCreditsLink')}
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default LegalPage;