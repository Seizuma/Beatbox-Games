import React, { useState, useEffect } from 'react';
import { useI18n } from '../utils/i18n';
import { useDiscordAuth } from '../utils/discordAuth';

function ContactPage() {
    const { t, language, switchLanguage } = useI18n();
    const { isAuthenticated, user, login, handleAuthCallback } = useDiscordAuth();

    const [formData, setFormData] = useState({
        type: 'bug', // 'bug' ou 'suggestion'
        category: 'blindtest', // 'blindtest', 'buzzer', 'other'
        details: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null); // 'success', 'error', ou null
    const [submissionLimits, setSubmissionLimits] = useState({});
    const [loadingLimits, setLoadingLimits] = useState(true);

    // 🔐 Gérer le callback Discord après connexion
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');

        if (token) {
            console.log('🔐 Token Discord reçu dans ContactPage');
            handleAuthCallback(token);

            // Nettoyer l'URL
            window.history.replaceState({}, '', window.location.pathname + window.location.hash.split('?')[0]);
        }
    }, [handleAuthCallback]);

    // Charger les limites de soumission au montage
    useEffect(() => {
        if (isAuthenticated) {
            loadSubmissionLimits();
        } else {
            setLoadingLimits(false);
        }
    }, [isAuthenticated]);

    const loadSubmissionLimits = async () => {
        try {
            const response = await fetch('/api/contact/limits', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('discord_token')}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setSubmissionLimits(data.limits);
            }
        } catch (error) {
            console.error('Erreur chargement limites:', error);
        } finally {
            setLoadingLimits(false);
        }
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.details.trim()) {
            setSubmitStatus('error');
            return;
        }

        setIsSubmitting(true);
        setSubmitStatus(null);

        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('discord_token')}`
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                setSubmitStatus('success');
                setFormData({
                    type: 'bug',
                    category: 'blindtest',
                    details: ''
                });
                // Recharger les limites
                loadSubmissionLimits();
            } else {
                // Gestion spécifique des erreurs
                if (response.status === 429 || data.rateLimited) {
                    setSubmitStatus('rate_limited');
                } else if (response.status === 401 || data.requireAuth) {
                    setSubmitStatus('auth_required');
                } else if (data.error && data.error.includes('10 characters')) {
                    setSubmitStatus('too_short');
                } else if (data.error && data.error.includes('2000 characters')) {
                    setSubmitStatus('too_long');
                } else {
                    setSubmitStatus('error');
                }
                console.error('Erreur API:', data.error);
            }
        } catch (error) {
            console.error('Erreur envoi contact:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDiscordLogin = () => {
        login('contact');
    };

    const getRemainingSubmissions = (category) => {
        return 10 - (submissionLimits[category] || 0);
    };

    const canSubmit = (category) => {
        return getRemainingSubmissions(category) > 0;
    };

    const isFrench = language === 'fr';
    const isEnglish = language === 'en';

    // Si pas connecté à Discord
    if (!isAuthenticated) {
        return (
            <div className="h-screen bg-gradient-to-br from-black via-slate-900 overflow-hidden overflow-y-auto">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-slate-900 to-black"></div>

                {/* Language Switch */}
                <div className="absolute top-4 right-4 z-20">
                    <div className="flex items-center gap-2 bg-zinc-800/90 backdrop-blur-sm border border-zinc-700/50 rounded-full p-1">
                        <button
                            onClick={() => switchLanguage('fr')}
                            className={`px-3 py-1 rounded-full text-sm font-medium transition-all duration-200 ${isFrench
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

                <div className="relative z-10 container mx-auto px-4 py-8 max-w-4xl">
                    {/* Back Button */}
                    <button
                        onClick={() => window.location.href = '/#/'}
                        className="mb-6 flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        {t('contactBackToHub')}
                    </button>

                    {/* Auth Required Message */}
                    <div className="text-center py-16">
                        <div className="max-w-md mx-auto bg-slate-800/50 backdrop-blur-sm border border-slate-600/50 rounded-2xl shadow-2xl p-8">
                            <div className="text-6xl mb-6">🔒</div>
                            <h1 className="text-2xl font-bold text-white mb-4">
                                {t('contactAuthRequired')}
                            </h1>
                            <p className="text-zinc-300 mb-6">
                                {t('contactAuthDescription')}
                            </p>
                            {/* <button
                                onClick={handleDiscordLogin}
                                className="w-full py-3 px-6 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                                </svg>
                                {t('contactDiscordLogin')}
                            </button> */}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen bg-gradient-to-br from-black via-slate-900 overflow-hidden overflow-y-auto">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-slate-900 to-black"></div>

            {/* Language Switch */}
            <div className="absolute top-4 right-4 z-20">
                <div className="flex items-center gap-2 bg-zinc-800/90 backdrop-blur-sm border border-zinc-700/50 rounded-full p-1">
                    <button
                        onClick={() => switchLanguage('fr')}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-all duration-200 ${isFrench
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

            <div className="relative z-10 container mx-auto px-4 py-8 max-w-4xl">
                {/* Back Button */}
                <button
                    onClick={() => window.location.href = '/#/'}
                    className="mb-6 flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    {t('contactBackToHub')}
                </button>

                {/* User Info */}
                <div className="mb-6 text-center">
                    <div className="inline-flex items-center gap-2 bg-green-500/20 border border-green-400/30 rounded-lg px-4 py-2">
                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                            <span className="text-xs">✓</span>
                        </div>
                        <span className="text-green-300">
                            {t('contactLoggedInAs', { username: user?.username })}
                        </span>
                    </div>
                </div>

                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
                        {t('contactPageTitle')}
                    </h1>
                    <p className="text-lg text-zinc-300 max-w-2xl mx-auto">
                        {t('contactIntro')}
                    </p>
                </div>

                {/* Form */}
                <div className="max-w-2xl mx-auto">
                    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-600/50 rounded-2xl shadow-2xl p-8">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Type de message */}
                            <div>
                                <label className="block text-white font-semibold mb-3">
                                    {t('contactCategoryType')}
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <button
                                        type="button"
                                        onClick={() => handleInputChange('type', 'bug')}
                                        className={`p-4 rounded-xl border-2 transition-all duration-200 text-left transform hover:scale-[1.02] ${formData.type === 'bug'
                                            ? 'border-red-400 bg-red-500/20 text-red-300 shadow-lg shadow-red-500/25'
                                            : 'border-slate-600 hover:border-red-400/50 text-zinc-300 hover:text-white hover:bg-red-500/10'
                                            }`}
                                    >
                                        <div className="font-semibold">{t('contactCategoryBugReport')}</div>
                                        <div className="text-sm opacity-75 mt-1">{t('contactBugDescription')}</div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleInputChange('type', 'suggestion')}
                                        className={`p-4 rounded-xl border-2 transition-all duration-200 text-left transform hover:scale-[1.02] ${formData.type === 'suggestion'
                                            ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300 shadow-lg shadow-cyan-500/25'
                                            : 'border-slate-600 hover:border-cyan-400/50 text-zinc-300 hover:text-white hover:bg-cyan-500/10'
                                            }`}
                                    >
                                        <div className="font-semibold">{t('contactCategorySuggestion')}</div>
                                        <div className="text-sm opacity-75 mt-1">{t('contactSuggestionDescription')}</div>
                                    </button>
                                </div>
                            </div>

                            {/* Sous-catégorie */}
                            <div>
                                <label className="block text-white font-semibold mb-3">
                                    {t('contactSubCategory')}
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => handleInputChange('category', 'blindtest')}
                                        disabled={!canSubmit('blindtest')}
                                        className={`p-3 rounded-lg border transition-all duration-200 transform hover:scale-[1.02] ${!canSubmit('blindtest')
                                            ? 'border-slate-700 bg-slate-700/20 text-slate-500 cursor-not-allowed'
                                            : formData.category === 'blindtest'
                                                ? 'border-purple-400 bg-purple-500/20 text-purple-300 shadow-lg shadow-purple-500/25'
                                                : 'border-slate-600 hover:border-purple-400/50 text-zinc-300 hover:text-white hover:bg-purple-500/10'
                                            }`}
                                    >
                                        🎵 {t('contactSubCategoryBlindtest')}
                                        {!canSubmit('blindtest') && (
                                            <div className="text-xs mt-1 text-red-400">
                                                {t('contactLimitReached')}
                                            </div>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleInputChange('category', 'buzzer')}
                                        disabled={!canSubmit('buzzer')}
                                        className={`p-3 rounded-lg border transition-all duration-200 transform hover:scale-[1.02] ${!canSubmit('buzzer')
                                            ? 'border-slate-700 bg-slate-700/20 text-slate-500 cursor-not-allowed'
                                            : formData.category === 'buzzer'
                                                ? 'border-yellow-400 bg-yellow-500/20 text-yellow-300 shadow-lg shadow-yellow-500/25'
                                                : 'border-slate-600 hover:border-yellow-400/50 text-zinc-300 hover:text-white hover:bg-yellow-500/10'
                                            }`}
                                    >
                                        ⚡ {t('contactSubCategoryBuzzer')}
                                        {!canSubmit('buzzer') && (
                                            <div className="text-xs mt-1 text-red-400">
                                                {t('contactLimitReached')}
                                            </div>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleInputChange('category', 'other')}
                                        disabled={!canSubmit('other')}
                                        className={`p-3 rounded-lg border transition-all duration-200 transform hover:scale-[1.02] ${!canSubmit('other')
                                            ? 'border-slate-700 bg-slate-700/20 text-slate-500 cursor-not-allowed'
                                            : formData.category === 'other'
                                                ? 'border-green-400 bg-green-500/20 text-green-300 shadow-lg shadow-green-500/25'
                                                : 'border-slate-600 hover:border-green-400/50 text-zinc-300 hover:text-white hover:bg-green-500/10'
                                            }`}
                                    >
                                        🔧 {t('contactSubCategoryOther')}
                                        {!canSubmit('other') && (
                                            <div className="text-xs mt-1 text-red-400">
                                                {t('contactLimitReached')}
                                            </div>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Détails */}
                            <div>
                                <label className="block text-white font-semibold mb-3">
                                    {t('contactDetailsLabel')}
                                </label>
                                <textarea
                                    value={formData.details}
                                    onChange={(e) => handleInputChange('details', e.target.value)}
                                    placeholder={t('contactDetailsPlaceholder')}
                                    rows={6}
                                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-zinc-400 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 focus:outline-none transition-colors duration-200 resize-vertical"
                                    required
                                />
                            </div>

                            {/* Status Messages */}
                            {submitStatus === 'success' && (
                                <div className="p-4 bg-green-500/20 border border-green-400 rounded-lg text-green-300">
                                    {t('contactSuccess')}
                                </div>
                            )}

                            {submitStatus === 'error' && (
                                <div className="p-4 bg-red-500/20 border border-red-400 rounded-lg text-red-300">
                                    {t('contactError')}
                                </div>
                            )}

                            {submitStatus === 'rate_limited' && (
                                <div className="p-4 bg-orange-500/20 border border-orange-400 rounded-lg text-orange-300">
                                    <div className="font-semibold mb-1">⏰ {t('contactRateLimitedTitle')}</div>
                                    <div>{t('contactRateLimited')}</div>
                                </div>
                            )}

                            {submitStatus === 'auth_required' && (
                                <div className="p-4 bg-purple-500/20 border border-purple-400 rounded-lg text-purple-300">
                                    <div className="font-semibold mb-1">🔒 {t('contactAuthExpiredTitle')}</div>
                                    <div>{t('contactAuthExpired')}</div>
                                </div>
                            )}

                            {submitStatus === 'too_short' && (
                                <div className="p-4 bg-yellow-500/20 border border-yellow-400 rounded-lg text-yellow-300">
                                    <div className="font-semibold mb-1">📝 {t('contactTooShortTitle')}</div>
                                    <div>{t('contactTooShort')}</div>
                                </div>
                            )}

                            {submitStatus === 'too_long' && (
                                <div className="p-4 bg-blue-500/20 border border-blue-400 rounded-lg text-blue-300">
                                    <div className="font-semibold mb-1">📏 {t('contactTooLongTitle')}</div>
                                    <div>{t('contactTooLong')}</div>
                                </div>
                            )}

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isSubmitting || !formData.details.trim() || !canSubmit(formData.category)}
                                className="w-full py-3 px-6 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 disabled:from-slate-600 disabled:to-slate-700 text-white font-semibold rounded-lg transition-all duration-200 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
                            >
                                {isSubmitting ? t('contactSending') : t('contactSendButton')}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ContactPage;