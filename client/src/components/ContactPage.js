import React, { useEffect, useId, useState } from 'react';
import SEO from './SEO';
import SiteShell from './site/SiteShell';
import { Notice, PageContainer, PageHeader, SiteButton } from './site/SiteUI';
import Icon from './icons/Icon';
import { useDiscordAuth } from '../utils/discordAuth';
import { useDiscordCallback } from '../utils/useDiscordCallback';
import { useSiteI18n } from '../utils/siteI18n';
import { API_BASE_URL, getStoredDiscordToken } from '../utils/useApi';

const MIN_LENGTH = 10;
const MAX_LENGTH = 2000;
const MAX_PER_CATEGORY = 10;
const CONTACT_EMAIL = 'contact@beatboxgames.com';

const STATUS_TONE = {
    success: 'success',
    error: 'error',
    rate_limited: 'error',
    auth_required: 'error',
    too_short: 'error',
    too_long: 'error',
};

const STATUS_KEY = {
    success: 'contact.success',
    error: 'contact.error',
    rate_limited: 'contact.rateLimited',
    auth_required: 'contact.authRequired',
    too_short: 'contact.tooShort',
    too_long: 'contact.tooLong',
};

// Carte de choix exclusive (radio) pour le type et la catégorie
function ChoiceCard({ name, value, checked, onChange, disabled, title, help }) {
    return (
        <label
            className={`flex cursor-pointer flex-col rounded-lg border px-4 py-3 transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-site-ink ${checked ? 'border-site-ink bg-site-tint' : 'border-site-line bg-site-surface hover:border-site-soft'} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
        >
            <input type="radio" name={name} value={value} checked={checked} onChange={onChange} disabled={disabled} className="sr-only" />
            <span className="flex items-center justify-between gap-2 text-sm font-bold">
                {title}
                {checked && <Icon name="check" size={16} />}
            </span>
            {help && <span className="mt-0.5 text-xs text-site-muted">{help}</span>}
        </label>
    );
}

function ContactForm() {
    const { t } = useSiteI18n();
    const { user } = useDiscordAuth();
    const detailsId = useId();
    const detailsHelpId = useId();

    const [formData, setFormData] = useState({ type: 'bug', category: 'blindtest', details: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null);
    const [submissionLimits, setSubmissionLimits] = useState({});

    const loadSubmissionLimits = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/contact/limits`, {
                headers: { Authorization: `Bearer ${getStoredDiscordToken()}` }
            });
            if (response.ok) {
                const data = await response.json();
                setSubmissionLimits(data.limits || {});
            }
        } catch (error) {
            console.error('Erreur chargement limites:', error);
        }
    };

    useEffect(() => {
        loadSubmissionLimits();
    }, []);

    const remaining = (category) => MAX_PER_CATEGORY - (submissionLimits[category] || 0);
    const canSubmitCategory = (category) => remaining(category) > 0;

    const update = (field, value) => {
        setFormData((previous) => ({ ...previous, [field]: value }));
        if (submitStatus && submitStatus !== 'success') setSubmitStatus(null);
    };

    const detailsLength = formData.details.trim().length;

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (detailsLength < MIN_LENGTH) {
            setSubmitStatus('too_short');
            return;
        }

        setIsSubmitting(true);
        setSubmitStatus(null);

        try {
            const response = await fetch(`${API_BASE_URL}/api/contact`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${getStoredDiscordToken()}`
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json().catch(() => ({}));

            if (response.ok) {
                setSubmitStatus('success');
                setFormData({ type: 'bug', category: 'blindtest', details: '' });
                loadSubmissionLimits();
            } else if (response.status === 429 || data.rateLimited) {
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
        } catch (error) {
            console.error('Erreur envoi contact:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const categoryRemaining = remaining(formData.category);
    const categoryOpen = canSubmitCategory(formData.category);

    const categories = [
        { id: 'blindtest', label: t('games.blindtest.name') },
        { id: 'buzzer', label: t('games.buzzer.name') },
        { id: 'other', label: t('contact.other') },
    ];

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-7" noValidate>
            <p className="flex items-center gap-2 text-sm text-site-muted">
                <Icon name="discord" size={16} />
                {t('contact.loggedAs', { name: user?.username || '' })}
            </p>

            <fieldset>
                <legend className="mb-2 text-sm font-bold">{t('contact.type')}</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                    <ChoiceCard name="contact-type" value="bug" checked={formData.type === 'bug'} onChange={() => update('type', 'bug')} title={t('contact.bug')} help={t('contact.bugHelp')} />
                    <ChoiceCard name="contact-type" value="suggestion" checked={formData.type === 'suggestion'} onChange={() => update('type', 'suggestion')} title={t('contact.suggestion')} help={t('contact.suggestionHelp')} />
                </div>
            </fieldset>

            <fieldset>
                <legend className="mb-2 text-sm font-bold">{t('contact.category')}</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                    {categories.map((category) => (
                        <ChoiceCard
                            key={category.id}
                            name="contact-category"
                            value={category.id}
                            checked={formData.category === category.id}
                            onChange={() => update('category', category.id)}
                            disabled={!canSubmitCategory(category.id)}
                            title={category.label}
                            help={!canSubmitCategory(category.id) ? t('contact.limitReached') : null}
                        />
                    ))}
                </div>
                <p className="mt-2 text-xs text-site-soft" aria-live="polite">
                    {categoryOpen ? t('contact.remaining', { count: categoryRemaining }) : t('contact.limitReached')}
                </p>
            </fieldset>

            <div>
                <label htmlFor={detailsId} className="mb-2 block text-sm font-bold">{t('contact.details')}</label>
                <textarea
                    id={detailsId}
                    value={formData.details}
                    onChange={(event) => update('details', event.target.value)}
                    placeholder={formData.type === 'bug' ? t('contact.placeholderBug') : t('contact.placeholderSuggestion')}
                    rows={7}
                    maxLength={MAX_LENGTH}
                    aria-describedby={detailsHelpId}
                    className="w-full resize-y rounded-lg border border-site-line bg-site-surface px-4 py-3 text-base text-site-ink placeholder:text-site-soft focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-site-ink"
                />
                <div id={detailsHelpId} className="mt-1.5 flex justify-between text-xs text-site-soft">
                    <span className={detailsLength > 0 && detailsLength < MIN_LENGTH ? 'font-semibold text-site-danger' : ''}>
                        {t('contact.minLength', { min: MIN_LENGTH })}
                    </span>
                    <span className="tabular-nums">{t('contact.counter', { count: formData.details.length, max: MAX_LENGTH })}</span>
                </div>
            </div>

            {submitStatus && <Notice tone={STATUS_TONE[submitStatus]}>{t(STATUS_KEY[submitStatus])}</Notice>}

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <SiteButton type="submit" disabled={isSubmitting || detailsLength < MIN_LENGTH || !categoryOpen}>
                    {isSubmitting ? t('contact.sending') : t('contact.send')}
                </SiteButton>
                <p className="text-xs text-site-soft">
                    {t('contact.email')}{' '}
                    <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-site-ink underline decoration-site-line decoration-2 underline-offset-4">{CONTACT_EMAIL}</a>
                </p>
            </div>
        </form>
    );
}

function ContactContent() {
    const { t } = useSiteI18n();
    const { isAuthenticated, login, loading } = useDiscordAuth();
    useDiscordCallback();

    const pending = !isAuthenticated && Boolean(getStoredDiscordToken());

    return (
        <>
            <SEO title={t('contact.seoTitle')} description={t('contact.intro')} url="https://beatboxgames.com/#/contact" />
            <PageContainer>
                <div className="max-w-2xl">
                    <PageHeader title={t('contact.title')} intro={t('contact.intro')} />
                    <div className="mt-8">
                        {isAuthenticated ? (
                            <ContactForm />
                        ) : pending ? (
                            <p className="py-10 text-site-soft" aria-live="polite">{t('profile.connecting')}</p>
                        ) : (
                            <div className="rounded-xl border border-site-line bg-site-surface p-6">
                                <h2 className="text-lg font-bold">{t('contact.loginTitle')}</h2>
                                <p className="mt-2 text-sm text-site-muted">{t('contact.loginText')}</p>
                                <SiteButton className="mt-5" onClick={() => login('contact')} disabled={loading}>
                                    <Icon name="discord" size={18} />
                                    {t('account.login')}
                                </SiteButton>
                                <p className="mt-5 text-xs text-site-soft">
                                    {t('contact.email')}{' '}
                                    <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-site-ink underline decoration-site-line decoration-2 underline-offset-4">{CONTACT_EMAIL}</a>
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </PageContainer>
        </>
    );
}

function ContactPage() {
    return (
        <SiteShell>
            <ContactContent />
        </SiteShell>
    );
}

export default ContactPage;