import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { LandingPage } from './routes/LandingPage';
import { MapWorkspace } from './features/map/MapWorkspace';
import { RegionsPage } from './routes/RegionsPage';
import { RegionDashboard } from './features/dashboard/RegionDashboard';
import { CompareView } from './features/compare/CompareView';
import { AnalysisReport } from './features/report/AnalysisReport';
import { MethodologyPage } from './routes/MethodologyPage';
import { DataLicencesPage } from './routes/DataLicencesPage';
import { AboutPage } from './routes/AboutPage';

export const App: React.FC = () => {
  const location = useLocation();
  const isFullscreenView = location.pathname === '/map' || location.pathname.startsWith('/compare');

  return (
    <div className="min-h-screen flex flex-col bg-paper text-ink">
      <Header />
      <main className="flex-1 flex flex-col">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/map" element={<MapWorkspace />} />
          <Route path="/compare/:aoi" element={<CompareView />} />
          <Route path="/regions" element={<RegionsPage />} />
          <Route path="/regions/:slug" element={<RegionDashboard />} />
          <Route path="/reports/:analysisId" element={<AnalysisReport />} />
          <Route path="/methodology" element={<MethodologyPage />} />
          <Route path="/data-licences" element={<DataLicencesPage />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </main>
      {!isFullscreenView && <Footer />}
    </div>
  );
};
