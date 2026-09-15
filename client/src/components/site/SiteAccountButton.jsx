import React from 'react';
import { Link } from 'react-router-dom';
import { useDiscordAuth } from '../../utils/discordAuth';
import { useSiteI18n } from '../../utils/siteI18n';
import Icon from '../icons/Icon';

export default function SiteAccountButton() {
    const { isAuthenticated, user, login, getAvatarUrl, loading } = useDiscordAuth();
    const { t } = useSiteI18n();

    if (isAuthenticated && user) {
        return (
            <Link
                to="/profile"
                title={t('account.profile', { name: user.username })}
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-1 hover:bg-site-tint sm:pr-3"
            >
                <img src={getAvatarUrl(64)} alt="" className="h-8 w-8 rounded-full bg-site-tint" />
                <span className="hidden max-w-[10rem] truncate text-sm font-semibold sm:inline">{user.username}</span>
                <span className="sr-only sm:hidden">{t('account.profile', { name: user.username })}</span>
            </Link>
        );
    }

    return (
        <button
            type="button"
            onClick={() => login('profile')}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-site-button px-2.5 py-2 text-sm font-bold text-site-on-button transition-colors hover:bg-site-button-hover disabled:cursor-wait disabled:opacity-70 sm:px-3"
        >
            <Icon name="discord" size={18} />
            <span className="sm:hidden">{loading ? t('account.loading') : t('account.loginShort')}</span>
            <span className="hidden sm:inline">{loading ? t('account.loading') : t('account.login')}</span>
        </button>
    );
}