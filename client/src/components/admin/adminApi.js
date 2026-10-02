import { API_BASE_URL, getStoredDiscordToken } from '../../utils/useApi';

// Requête authentifiée vers l'API d'administration
export const authFetch = (path, options = {}) => fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getStoredDiscordToken()}`,
        ...(options.headers || {}),
    },
});

/** POST JSON ; renvoie le corps de la réponse, avec `ok` et `status` en plus. */
export async function postJson(path, body = {}, method = 'POST') {
    try {
        const response = await authFetch(path, { method, body: JSON.stringify(body) });
        const data = await response.json().catch(() => ({}));
        return { ...data, ok: response.ok, status: response.status };
    } catch (error) {
        return { ok: false, status: 0, error: 'network_error' };
    }
}

/** URL absolue d'une image de revue (le serveur renvoie un chemin signé). */
export const reviewImageUrl = (src) => `${API_BASE_URL}${src}`;
