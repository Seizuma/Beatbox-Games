// Imports OBLIGATOIREMENT en premier pour ESLint
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { HashRouter } from 'react-router-dom';

// ✅ NOUVEAU : Détection intelligente de l'environnement
const getEnvironment = () => {
  // Variables d'environnement React (définies au build)
  if (process.env.REACT_APP_ENV) {
    return process.env.REACT_APP_ENV;
  }

  // Détection par NODE_ENV
  if (process.env.NODE_ENV === 'production') {
    // Si on est sur dev.beatboxgames.com = staging
    if (window.location.hostname === 'dev.beatboxgames.com') {
      return 'staging';
    }
    return 'production';
  }

  // Détection par hostname
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'development';
  }

  return 'development';
};

const ENVIRONMENT = getEnvironment();

// ✅ Configuration de la console selon l'environnement - VERSION CORRIGÉE
const configureConsole = (environment) => {
  // ✅ CORRECTION : Console toujours active en staging pour le débogage
  const shouldDisableConsole = environment === 'production';

  if (shouldDisableConsole) {
    // Sauvegarder une référence pour un éventuel debug
    window._originalConsole = { ...console };
    window._environment = environment;

    // Créer des fonctions vides
    const noop = () => { };

    // Désactiver tous les logs en production
    console.log = noop;
    console.debug = noop;
    console.info = noop;
    console.warn = noop;
    console.error = noop;

    // Message unique pour confirmer la désactivation
    console.clear();
    if (window._originalConsole && window._originalConsole.log) {
      window._originalConsole.log(
        '%c🎵 BeatBox Games - PRODUCTION - Console désactivée',
        'color: #ff6b6b; font-size: 16px; font-weight: bold;'
      );
    }
  } else {
    // ✅ LOGS ENRICHIS pour development ET staging
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    // Ajouter des préfixes colorés selon l'environnement
    const prefix = environment === 'development' ?
      '%c💻 DEV' : '%c🔧 STAGING';
    const color = environment === 'development' ?
      'color: #4ecdc4; font-weight: bold;' : 'color: #9b59b6; font-weight: bold;';

    console.log = (...args) => {
      originalLog(`${prefix}%c`, color, 'color: inherit;', ...args);
    };

    console.error = (...args) => {
      originalError(`${prefix} ❌%c`, color, 'color: inherit;', ...args);
    };

    console.warn = (...args) => {
      originalWarn(`${prefix} ⚠️%c`, color, 'color: inherit;', ...args);
    };

    // Message de démarrage avec informations d'environnement
    console.log('🚀 BeatBox Games Client Started');
    console.log('Environment:', environment);
    console.log('API URL:', process.env.REACT_APP_API_URL || 'Default');
    console.log('Hostname:', window.location.hostname);
    console.log('Build time:', new Date().toISOString());

    // ✅ LOGS DE DEBUG SOCKET SPÉCIALEMENT POUR STAGING
    if (environment === 'staging') {
      console.log('🔍 STAGING DEBUG MODE - Logs Socket.io activés');
      console.log('📡 Pour surveiller les connexions, regarder les logs préfixés 🚀, 📤, 📥');
    }

    // ✅ Informations de debug utiles pour le développement ET staging
    if (environment !== 'production') {
      console.log('🛠️ Debug mode enabled');
      console.log('Available environment variables:', {
        NODE_ENV: process.env.NODE_ENV,
        REACT_APP_ENV: process.env.REACT_APP_ENV,
        REACT_APP_API_URL: process.env.REACT_APP_API_URL
      });

      // Exposer des utilitaires de debug globaux
      window._beatboxDebug = {
        environment: environment,
        toggleConsole: () => {
          if (window._originalConsole) {
            Object.assign(console, window._originalConsole);
            console.log('Console re-enabled');
          }
        },
        getSocketInfo: () => {
          if (window.socketOnline) {
            return {
              connected: window.socketOnline.connected,
              id: window.socketOnline.id,
              transport: window.socketOnline.io?.engine?.transport?.name
            };
          }
          return 'Socket not available';
        },
        clearStorage: () => {
          localStorage.clear();
          sessionStorage.clear();
          console.log('Storage cleared');
        },
        version: '2.1.0-dev',
        // ✅ NOUVEAU : Helper pour déboguer les problèmes Socket
        debugSocket: () => {
          console.log('🔍 SOCKET DEBUG INFO:', {
            connected: window.socketOnline?.connected,
            id: window.socketOnline?.id,
            transport: window.socketOnline?.io?.engine?.transport?.name,
            auth: !!window.socketOnline?.auth,
            listeners: Object.keys(window.socketOnline?._callbacks || {})
          });
        }
      };

      console.log('🔧 Debug utilities available at window._beatboxDebug');

      // ✅ EXPOSER socketOnline globalement pour le debug
      if (typeof window !== 'undefined') {
        window._exposeSocket = (socket) => {
          window.socketOnline = socket;
          console.log('📡 Socket exposé globalement pour debug');
        };
      }
    }
  }
};

// ✅ Configuration de l'environnement client
const configureEnvironment = (environment) => {
  // Ajouter une classe CSS pour l'environnement (utile pour les styles)
  document.documentElement.classList.add(`env-${environment}`);

  // Métadonnées spécifiques à l'environnement
  const metaEnv = document.createElement('meta');
  metaEnv.name = 'beatbox-environment';
  metaEnv.content = environment;
  document.head.appendChild(metaEnv);

  // Désactiver l'indexation en staging
  if (environment === 'staging') {
    const metaRobots = document.createElement('meta');
    metaRobots.name = 'robots';
    metaRobots.content = 'noindex, nofollow';
    document.head.appendChild(metaRobots);
  }

  // Titre spécifique selon l'environnement
  if (environment === 'staging') {
    document.title = '🔧 [DEV] BeatBox Games';
  } else if (environment === 'development') {
    document.title = '💻 [LOCAL] BeatBox Games';
  }

  // Favicon différent pour les environnements de dev
  if (environment !== 'production') {
    const favicon = document.querySelector('link[rel="icon"]');
    if (favicon) {
      // Vous pouvez créer des favicons différents pour staging/dev
      // favicon.href = `/favicon-${environment}.ico`;
    }
  }
};

// ✅ Gestion des erreurs selon l'environnement
const configureErrorHandling = (environment) => {
  window.addEventListener('error', (event) => {
    const errorInfo = {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error,
      environment: environment,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent
    };

    // En production, logger discrètement
    if (environment === 'production') {
      // Ici vous pourriez envoyer à un service de monitoring
      console.error('Application error:', errorInfo);
    } else {
      // En dev/staging, afficher plus d'infos
      console.error('🚨 JavaScript Error:', errorInfo);

      // En développement, vous pourriez afficher une notification visuelle
      if (environment === 'development') {
        // Optionnel: créer un toast d'erreur visible
        console.warn('💡 Error details available in console');
      }
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const errorInfo = {
      reason: event.reason,
      promise: event.promise,
      environment: environment,
      timestamp: new Date().toISOString(),
      url: window.location.href
    };

    if (environment === 'production') {
      console.error('Unhandled promise rejection:', errorInfo);
    } else {
      console.error('🚨 Unhandled Promise Rejection:', errorInfo);
    }
  });
};

// ✅ Application de toute la configuration
configureEnvironment(ENVIRONMENT);
configureConsole(ENVIRONMENT);
configureErrorHandling(ENVIRONMENT);

// ✅ Démarrage de l'application React
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);

// ✅ Reporting des performances avec informations d'environnement
reportWebVitals((metric) => {
  if (ENVIRONMENT !== 'production') {
    console.log('📊 Performance metric:', {
      ...metric,
      environment: ENVIRONMENT
    });
  }

  // En production, vous pourriez envoyer les métriques à un service d'analytics
  if (ENVIRONMENT === 'production') {
    // Exemple: gtag('event', metric.name, { ...metric });
  }
});