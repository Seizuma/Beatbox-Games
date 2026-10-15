// Beatbox Party est en test : visible partout sauf sur le site public (beatboxgames.com).
// Le build de production a REACT_APP_ENV=production ; la version de test, staging.
export const PARTY_ENABLED = process.env.REACT_APP_ENV !== 'production';
