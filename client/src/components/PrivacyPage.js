import React from 'react';
import { useI18n } from '../utils/i18n';
import SEO from './SEO';

function PrivacyPage() {
    const { t, switchLanguage, isEnglish } = useI18n();

    const handleGoBack = () => {
        window.location.href = '/#/';
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
            <SEO title={t('privacyPageTitle')} description={t('privacyIntroText')} />

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
                    <h1 className="text-4xl font-bold text-cyan-400 mb-6">🔒 {t('privacyPageTitle')}</h1>

                    <p className="text-zinc-400 mb-8">
                        {t('privacyLastUpdate', {
                            date: new Date().toLocaleDateString(isEnglish ? 'en-US' : 'fr-FR'),
                        })}
                    </p>

                    <div className="bg-cyan-900/20 border border-cyan-600/30 rounded-lg p-6 mb-8">
                        <h2 className="text-xl font-bold text-white mb-3">📌 {t('privacyBriefTitle')}</h2>
                        <ul className="text-zinc-300 space-y-2">
                            <li>✅ {t('privacyBrief1')}</li>
                            <li>✅ {t('privacyBrief2')}</li>
                            <li>✅ {t('privacyBrief3')}</li>
                            <li>✅ {t('privacyBrief4')}</li>
                        </ul>
                    </div>

                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-white mb-4">{t('privacyIntroTitle')}</h2>
                        <p className="text-zinc-300 leading-relaxed">{t('privacyIntroText')}</p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-white mb-4">{t('privacyDataCollectedTitle')}</h2>
                        <div className="space-y-4">
                            <div className="bg-zinc-900/50 rounded-lg p-5">
                                <h3 className="text-lg font-semibold text-green-400 mb-2">
                                    {t('privacyAnonymousMode')}
                                </h3>
                                <p className="text-zinc-300">{t('privacyAnonymousText')}</p>
                            </div>

                            <div className="bg-zinc-900/50 rounded-lg p-5">
                                <h3 className="text-lg font-semibold text-cyan-400 mb-2">
                                    {t('privacyDiscordMode')}
                                </h3>
                                <p className="text-zinc-300 mb-3">{t('privacyDiscordIntro')}</p>
                                <ul className="list-disc list-inside text-zinc-300 space-y-1 ml-4">
                                    <li>{t('privacyDataDiscordId')}</li>
                                    <li>{t('privacyDataUsername')}</li>
                                    <li>{t('privacyDataAvatar')}</li>
                                    <li>
                                        {t('privacyDataStats')}
                                        <ul className="list-disc list-inside ml-6 mt-1 text-sm">
                                            <li>{t('privacyDataGamesPlayed')}</li>
                                            <li>{t('privacyDataScores')}</li>
                                            <li>{t('privacyDataWins')}</li>
                                            <li>{t('privacyDataDates')}</li>
                                            <li>{t('privacyDataHistory')}</li>
                                        </ul>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-white mb-4">{t('privacyDataUsageTitle')}</h2>
                        <p className="text-zinc-300 mb-3">{t('privacyDataUsageIntro')}</p>
                        <ul className="list-disc list-inside text-zinc-300 space-y-1 ml-4">
                            <li>{t('privacyDataUsageAuth')}</li>
                            <li>{t('privacyDataUsageScores')}</li>
                            <li>{t('privacyDataUsageLeaderboard')}</li>
                            <li>{t('privacyDataUsageComm')}</li>
                        </ul>
                        <p className="text-zinc-300 mt-3">
                            <strong>{t('privacyNoAds')}</strong>
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-white mb-4">{t('privacyStorageTitle')}</h2>
                        <div className="text-zinc-300 space-y-3">
                            <p>
                                <strong>{t('privacyStorageLocation')}</strong> {t('privacyStorageLocationText')}
                            </p>
                            <p>
                                <strong>{t('privacyStorageSecurity')}</strong> {t('privacySecurityText')}
                            </p>
                            <p>
                                <strong>{t('privacyStorageRetention')}</strong> {t('privacyRetentionText')}
                            </p>
                        </div>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-white mb-4">{t('privacyCookiesTitle')}</h2>
                        <p className="text-zinc-300 mb-3">{t('privacyCookiesIntro')}</p>
                        <ul className="list-disc list-inside text-zinc-300 space-y-2 ml-4">
                            <li>{t('privacyCookiesLocalStorage')}</li>
                            <li>{t('privacyCookiesSessionStorage')}</li>
                        </ul>
                        <p className="text-zinc-300 mt-3">
                            <strong>{t('privacyCookiesNoTracking')}</strong>
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-white mb-4">{t('privacySharingTitle')}</h2>
                        <div className="bg-green-900/20 border border-green-600/30 rounded-lg p-5">
                            <p className="text-zinc-300 font-semibold mb-2">{t('privacySharingNoShare')}</p>
                            <p className="text-zinc-300 text-sm">{t('privacySharingInternal')}</p>
                        </div>
                        <p className="text-zinc-400 text-sm mt-3">
                            <strong>{t('privacySharingPublic')}</strong>
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-white mb-4">{t('privacyRightsTitle')}</h2>
                        <p className="text-zinc-300 mb-3">{t('privacyRightsIntro')}</p>
                        <ul className="list-disc list-inside text-zinc-300 space-y-2 ml-4">
                            <li>{t('privacyRightsAccess')}</li>
                            <li>{t('privacyRightsRectification')}</li>
                            <li>{t('privacyRightsErasure')}</li>
                            <li>{t('privacyRightsObjection')}</li>
                            <li>{t('privacyRightsPortability')}</li>
                        </ul>
                        <p className="text-zinc-300 mt-3 bg-cyan-900/20 border border-cyan-600/30 rounded-lg p-4">
                            {t('privacyRightsExercise')}
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-white mb-4">{t('privacyThirdPartyTitle')}</h2>
                        <p className="text-zinc-300">
                            {t('privacyThirdPartyText')}{' '}
                            {isEnglish ? (
                                <a
                                    href="https://discord.com/privacy"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-cyan-400 hover:text-cyan-300 underline"
                                >
                                    Discord's Privacy Policy
                                </a>
                            ) : (
                                <>
                                    <a
                                        href="https://discord.com/privacy"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-cyan-400 hover:text-cyan-300 underline"
                                    >
                                        {t('privacyThirdPartyLink')}
                                    </a>
                                </>
                            )}
                            .
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-white mb-4">{t('privacyUpdatesTitle')}</h2>
                        <p className="text-zinc-300">{t('privacyUpdatesText')}</p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">{t('privacyContactTitle')}</h2>
                        <p className="text-zinc-300 mb-3">{t('privacyContactIntro')}</p>
                        <div className="bg-zinc-900/50 rounded-lg p-4">
                            <a
                                href="mailto:contact@beatboxgames.com"
                                className="text-cyan-400 hover:text-cyan-300 font-semibold text-lg transition-colors"
                            >
                                📮 contact@beatboxgames.com
                            </a>
                            <p className="text-zinc-400 text-sm mt-2">{t('privacyContactResponse')}</p>
                        </div>
                    </section>
                </div>

                <div className="mt-8 text-center text-zinc-400 text-sm">
                    <a href="/#/legal" className="hover:text-cyan-400 transition-colors">
                        {t('privacyFooterLegalLink')}
                    </a>
                </div>
            </div>
        </div>
    );
}

export default PrivacyPage;