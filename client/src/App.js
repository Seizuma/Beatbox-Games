import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import BlindTestOnline from './BlindTestOnline';
import BuzzerBattle from './BuzzerBattle';
import Beatboxdle from './Beatboxdle';
import Hub from './components/Hub';
import CreditsPage from './components/CreditsPage';
import StatsPage from './components/StatsPage';
import ProfilePage from './components/ProfilePage';
import PrivacyPage from './components/PrivacyPage';
import LegalPage from './components/LegalPage';
import ContactPage from './components/ContactPage';
import PlayerPage from './components/PlayerPage';
import AdminPage from './components/AdminPage';
import NotFoundPage from './components/NotFoundPage';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  const location = useLocation();

  return (
    <ErrorBoundary resetKey={location.pathname}>
      <Routes>
        <Route path="/" element={<Hub />} />
        <Route path="/blindtest" element={<Navigate to="/blindtest-online" replace />} />
        <Route path="/blindtest-online" element={<BlindTestOnline />} />
        <Route path="/buzzer-battle" element={<BuzzerBattle />} />
        <Route path="/beatboxdle" element={<Beatboxdle />} />
        <Route path="/credits" element={<CreditsPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/player/:discordId" element={<PlayerPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/legal" element={<LegalPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
