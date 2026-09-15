import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import BlindTestOnline from './BlindTestOnline';
import BuzzerBattle from './BuzzerBattle';
import Hub from './components/Hub';
import CreditsPage from './components/CreditsPage';
import StatsPage from './components/StatsPage';
import ProfilePage from './components/ProfilePage'; // ✅ NOUVEAU
import PrivacyPage from './components/PrivacyPage';
import LegalPage from './components/LegalPage';
import ContactPage from './components/ContactPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Hub />} />
      <Route path="/blindtest" element={<Navigate to="/blindtest-online" replace />} />
      <Route path="/blindtest-online" element={<BlindTestOnline />} />
      <Route path="/buzzer-battle" element={<BuzzerBattle />} />
      <Route path="/credits" element={<CreditsPage />} />
      <Route path="/stats" element={<StatsPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/legal" element={<LegalPage />} />
      <Route path="/contact" element={<ContactPage />} />
    </Routes>
  );
}

export default App;